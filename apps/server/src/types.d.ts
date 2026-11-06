declare module "*.sql" {
  const content: string;
  export default content;
}

declare module "@minescript/engine/wasm" {
  const path: string;
  export default path;
}
