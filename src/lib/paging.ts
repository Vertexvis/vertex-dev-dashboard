export interface Paged<T> {
  readonly cursor: string | null; // Must use null for proper NextJS serialization
  readonly items: T[];
}
