export const Revision = Symbol.for("Revision");

type RevisionValue = number;

export interface Edition<Value> {
  readonly [Revision]: RevisionValue;
  readonly key: symbol;
  readonly value: Value;
}

function render<Value>(data: Edition<Value>): void {}

export function combine<A, B>(
  a: Edition<A>,
  b: Edition<B>
): Edition<{ [k: symbol]: A | B }> {
  const revision = Math.max(a[Revision], b[Revision]);
  return {
    [Revision]: revision,
    key: Symbol("FIXME"),
    value: {
      [a.key]: a.value,
      [b.key]: b.value,
    },
  };
}

export function newEdition<Value>(
  value: Value,
  revision = 0,
  key: symbol = Symbol()
): Edition<Value> {
  return {
    [Revision]: revision,
    key,
    value,
  };
}

export function newEditionList<Value>(
  items: Iterable<Value>,
  key: symbol = Symbol(),
  revision = 0
): Edition<Iterable<Edition<Value>>> {
  return {
    [Revision]: revision,
    key,
    value: Array.from(items, (item) => newEdition(item, revision)),
  };
}

export function nextEdition<Value>(
  original: Edition<Value>,
  transform: (
    value: Value,
    revision: typeof original[typeof Revision]
  ) => Value,
  otherRevision?: RevisionValue
): Edition<Value> {
  const revision =
    typeof otherRevision === "number"
      ? Math.max(original[Revision] + 1, otherRevision)
      : original[Revision] + 1;
  return {
    [Revision]: revision,
    key: original.key,
    value: transform(original.value, revision),
  };
}

export function append<Element>(
  source: Edition<Iterable<Edition<Element>>>,
  element: Element,
  key = Symbol()
): Edition<Iterable<Edition<Element>>> {
  return nextEdition(source, (iterable, revision) => ({
    *[Symbol.iterator]() {
      yield* iterable;
      yield newEdition(element, revision, key);
    },
  }));
}

export function replace<Element>(
  source: Edition<Iterable<Edition<Element>>>,
  elementKey: symbol,
  transform: (element: Element) => Element
): Edition<Iterable<Edition<Element>>> {
  return nextEdition(source, (iterable, revision) => ({
    *[Symbol.iterator]() {
      for (const element of iterable) {
        if (element.key === elementKey) {
          yield nextEdition(element, transform, revision);
        } else {
          yield element;
        }
      }
    },
  }));
}

export interface EditionReference<Value> {
  readonly defaultValue: Value;
}

export interface EditionListReference<Element> {
  readonly defaultValue: Iterable<Element>;
  append(element: Element, elementKey?: symbol): void;
  replace(elementKey: symbol, transform: (element: Element) => Element): void;
  toArray(): ReadonlyArray<Edition<Element>>;
}
