import { mergeConfig } from "@signe/di";
import { provideRpg, startGame } from "@rpgjs/client";
import startServer from "./server";
import configClient from "./config.client";

void startGame(
  mergeConfig(configClient, {
    providers: [provideRpg(startServer)],
  }),
);
