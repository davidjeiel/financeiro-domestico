import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@/data/router";

export const trpc = createTRPCReact<AppRouter>();
