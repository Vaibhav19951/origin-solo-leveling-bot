import app from "./app";
import { logger } from "./lib/logger";
import { startBot } from "./bot/index";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Start the Telegram bot
  try {
    const bot = startBot();

    // Graceful shutdown
    process.once("SIGINT", () => {
      logger.info("SIGINT received — stopping bot");
      bot.stop("SIGINT");
    });
    process.once("SIGTERM", () => {
      logger.info("SIGTERM received — stopping bot");
      bot.stop("SIGTERM");
    });
  } catch (err) {
    logger.error({ err }, "Failed to start Telegram bot");
  }
});
