import { LoggerService, Module } from "@nestjs/common";
import BuynanLogger from "bunyan"
import { debug } from "debug";
import { basename } from "path";
import { get as getStackTrace } from 'stack-trace'

export const rootLoggerNamespace = 'training'

function configureProcessEnvDebugVariable() {
  if (!process.env.DEBUG) {
    process.env.DEBUG = `${rootLoggerNamespace}:*,${rootLoggerNamespace},typeorm:*`
    debug.enable(process.env.DEBUG)
  }
}

configureProcessEnvDebugVariable()

// we use debug library to parse the process.env.DEBUG variable, yeah, one could optimize that
function levelForLogger(loggerName: string) {
  const debuggerForLevel = debug(loggerName);
  return debuggerForLevel.enabled ? "trace" : "error"
}

function createLogger(name: string) {
  return new BuynanLogger({
    name: name,
    level: levelForLogger(name)
  });
}

const rootLogger = createLogger(rootLoggerNamespace)

function createChildLogger(childLoggerName: string) {
  return createLogger(rootLoggerNamespace + ":" + childLoggerName)
}

export function getLogger() {
  const stack = getStackTrace(getLogger)
  const withFileName = stack.find(s => !!s.getFileName())
  const callingFilePath = withFileName ? withFileName.getFileName() : null;
  // path to file in dir as an alternative
  // const callingFileName = callingFilePath ? callingFilePath.replace(packageJsonDirectory, "") : null
  const callingFileName = callingFilePath ? basename(callingFilePath) : null
  return callingFileName ? createChildLogger(callingFileName.replace(".ts", "").replace(".js", "")) : rootLogger
}

export class NestLoggerAdapter implements LoggerService {
  constructor(private readonly logger = getLogger()) {
  }

  error(message: any, trace?: string, context?: string): any {
    this.logger.error({ message, trace, context })
  }

  log(message: any, context?: string): any {
    this.logger.debug({ message, context })
  }

  warn(message: any, context?: string): any {
    this.logger.warn({ message, context })
  }

}

@Module({
  providers: [],
  exports: []
})
export class LoggingModule {
}
