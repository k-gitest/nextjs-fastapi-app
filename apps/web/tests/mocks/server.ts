import { setupServer } from "msw/node";
import { handlers } from '@tests/mocks'

export const server = setupServer(...handlers)