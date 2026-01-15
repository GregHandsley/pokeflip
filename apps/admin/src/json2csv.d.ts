declare module "json2csv" {
  export class Parser {
    constructor(options?: Record<string, unknown>);
    parse(data: Record<string, unknown>[]): string;
  }
}
