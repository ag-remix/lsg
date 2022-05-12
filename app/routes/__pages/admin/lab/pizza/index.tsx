import type { ActionFunction, LoaderFunction } from "remix";
import { CheckIcon } from "@chakra-ui/icons";
import {
	Heading,
	Text,
	chakra,
	VStack,
	Radio,
	RadioGroup,
	Box,
	useColorModeValue,
} from "@chakra-ui/react";
import { withZod } from "@remix-validated-form/with-zod";
import { useState } from "react";
import { ValidatedForm, validationError } from "remix-validated-form";
import { UserData } from "~models";
import { authorize, commitSession, revalidate } from "~feat/auth";
import { SubmitButton } from "~feat/form";
import { prisma } from "~lib/prisma";
import { respond, useActionResponse, useLoaderResponse } from "~lib/response";

const UserValidatorData = UserData.pick({
	pizzaUUID: true,
});
const UserValidator = withZod(UserValidatorData);

type LoaderData = {
	pizzas: {
		price: number;
		name: string;
		uuid: string;
	}[];
	pizzaUUID?: string | null;
	status: number;
};
const getLoaderData = async (request: Request): Promise<LoaderData> => {
	const { pizzaUUID } = await authorize(request, { lab: true });

	const pizzas = await prisma.pizza.findMany({
		orderBy: {
			price: "asc",
		},
		select: {
			name: true,
			price: true,
			uuid: true,
		},
	});

	return {
		pizzas,
		pizzaUUID,
		status: 200,
	};
};
export const loader: LoaderFunction = async ({ request }) =>
	respond<LoaderData>(await getLoaderData(request));

type ActionData = {
	formError?: string;
	headers?: HeadersInit;
	status: number;
};
const getActionData = async (request: Request): Promise<ActionData> => {
	const { did } = await authorize(request, { lab: true });

	const form = await request.formData();
	const { error, data } = await UserValidator.validate(form);
	if (error) throw validationError(error);

	await prisma.user.update({
		data,
		select: {
			uuid: true,
		},
		where: {
			did,
		},
	});

	const session = await revalidate(request, did);

	return {
		headers: {
			"Set-Cookie": await commitSession(session),
		},
		status: 200,
	};
};
export const action: ActionFunction = async ({ request }) =>
	respond<ActionData>(await getActionData(request));

export default function Index(): JSX.Element {
	const { pizzas, pizzaUUID } = useLoaderResponse<LoaderData>();
	const { formError } = useActionResponse<ActionData>();
	const [pizza, setPizza] = useState(pizzaUUID);
	const checkColor = useColorModeValue("green.600", "green.400");

	return (
		<chakra.main w="full">
			<Heading as="h1" size="xl">
				Pizza
			</Heading>
			<Text fontSize="md" mt={2}>
				Bestellung für den nächsten Freitag abgeben
			</Text>
			<ValidatedForm validator={UserValidator} method="post">
				<RadioGroup
					onChange={setPizza}
					value={pizza || undefined}
					my={4}
					name="pizzaUUID">
					<VStack>
						{pizzas.map(({ name, price, uuid }) => (
							<Box w="full" key={uuid}>
								<Radio value={uuid}>
									{name} ({(price / 100).toFixed(2)}€){" "}
									{pizzaUUID === uuid && (
										<CheckIcon mr={2} color={checkColor} />
									)}
								</Radio>
							</Box>
						))}
					</VStack>
				</RadioGroup>
				<SubmitButton>:D</SubmitButton>
			</ValidatedForm>
			{formError && (
				<Text maxW="2xl" fontSize="md" color="red.400">
					{formError}
				</Text>
			)}
		</chakra.main>
	);
}
