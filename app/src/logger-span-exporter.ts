import { ExportResult, ExportResultCode } from "@opentelemetry/core";
import { ConsoleSpanExporter, ReadableSpan, SpanExporter } from "@opentelemetry/sdk-trace-base";
import Logger from "bunyan";

export class LoggerSpanExporter implements SpanExporter {
  constructor(private readonly logger: Logger) {
  }

  consoleSpanExporter = new ConsoleSpanExporter();

  export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
    for (const span of spans) {
      // @ts-ignore
      const formatted = this.consoleSpanExporter._exportInfo(span);
      this.logger.trace(formatted);
    }

    resultCallback({ code: ExportResultCode.SUCCESS });
  }

  async shutdown(): Promise<void> {
  }
}
