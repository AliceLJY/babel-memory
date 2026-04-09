declare module "snowball-stemmers" {
  export function newStemmer(algorithm: string): { stem(word: string): string };
  export function algorithms(): string[];
}
