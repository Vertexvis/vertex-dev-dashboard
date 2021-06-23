export interface Paged<T> {
  cursor: string | null; // Must use null for proper NextJS serialization
  items: T[];
}
