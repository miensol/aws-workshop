import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import {
  CompositePropagator,
  W3CBaggagePropagator,
  W3CTraceContextPropagator
} from '@opentelemetry/core';
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { AWSXRayIdGenerator } from "@opentelemetry/id-generator-aws-xray";
import { AWSXRayPropagator } from "@opentelemetry/propagator-aws-xray";
import { B3InjectEncoding, B3Propagator } from '@opentelemetry/propagator-b3';
import { Resource } from "@opentelemetry/resources";
import { NodeSDK } from '@opentelemetry/sdk-node';
import { TracerConfig } from "@opentelemetry/sdk-trace-base";
import {
  SemanticResourceAttributes
} from "@opentelemetry/semantic-conventions";
import { OpenTelemetryModule } from "nestjs-otel";
import { CompositeSpanExporter } from "./composite-span-exporeter";
import { LoggerSpanExporter } from "./logger-span-exporter";
import { getLogger } from "./logging.module";
import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
// Setting the default Global logger to use the Console
// And optionally change the logging level (Defaults to INFO)
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR)

const logger = getLogger();

export const otelSDK = new NodeSDK({
  // metricExporter: new PrometheusExporter({
  //   port: 8081,
  // }), //
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'training'
  }),
  metricInterval: 1000,
  contextManager: new AsyncLocalStorageContextManager(),
  traceExporter: new CompositeSpanExporter(new OTLPTraceExporter(), new LoggerSpanExporter(logger)),
  textMapPropagator: new CompositePropagator({
    propagators: [
      new AWSXRayPropagator(),
      new W3CTraceContextPropagator(),
      new W3CBaggagePropagator(),
      new B3Propagator(),
      new B3Propagator({
        injectEncoding: B3InjectEncoding.MULTI_HEADER,
      }),
    ],
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});

// As of now aws-otel will only export traces to x-ray if trace id format is compatible
// @ts-ignore
const tracerConfig: TracerConfig = otelSDK._tracerProviderConfig.tracerConfig;
tracerConfig.idGenerator = new AWSXRayIdGenerator()


// You can also use the shutdown method to gracefully shut down the SDK before process shutdown
// or on some operating system signal.

process.on('SIGTERM', () => {
  otelSDK
    .shutdown()
    .then(
      () => console.log('SDK shut down successfully'),
      (err) => console.log('Error shutting down SDK', err),
    )
    .finally(() => process.exit(0));
});

export const OpenTelemetryModuleConfig = OpenTelemetryModule.forRoot({
  metrics: {
    hostMetrics: true, // Includes Host Metrics
    defaultMetrics: false, // Includes Default Metrics, true fails currently because of libraries api mismatch in opentelemetry-node-metrics
    apiMetrics: {
      enable: true, // Includes api metrics
      ignoreRoutes: ['/favicon.ico'], // You can ignore specific routes (See https://docs.nestjs.com/middleware#excluding-routes for options)
      ignoreUndefinedRoutes: false, //Records metrics for all URLs, even undefined ones
    },
  },
});
