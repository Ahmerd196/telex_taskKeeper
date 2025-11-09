declare module "chrono-node" {
  export function parseDate(text: string, ref?: Date, options?: { forwardDate?: boolean }): Date | null;
  export function parse(text: string, ref?: Date, options?: { forwardDate?: boolean }): any[];
}
