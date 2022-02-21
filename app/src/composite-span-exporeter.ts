import { ExportResult, ExportResultCode } from "@opentelemetry/core";
import { ReadableSpan, SpanExporter } from "@opentelemetry/sdk-trace-base";

export class CompositeSpanExporter implements SpanExporter {
  constructor(private readonly first: SpanExporter, private readonly second: SpanExporter) {
  }

  export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
    this.first.export(spans, result => {
      if (result.code == ExportResultCode.SUCCESS) {
        this.second.export(spans, resultCallback)
      } else {
        resultCallback(result)
      }
    })
  }

  shutdown(): Promise<void> {
    return Promise.resolve(undefined);
  }
}
