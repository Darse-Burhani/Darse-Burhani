declare module 'react-twemoji' {
  export default Twemoji;
  export namespace Twemoji {
    export function render(emoji: string, options?: { height?: number; width?: number }): string;
  }
}
