declare module "*.sql" {
  const content: string;
  export default content;
}

declare module "@minescript/engine/wasm" {
  const path: string;
  export default path;
}

declare module "*.ms" {
  const content: string;
  export default content;
}
