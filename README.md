# Lifeboat

Lifeboat is a simple library for generating typescript type guards. Its purpose is to let you handle data from outside typescript, like from a network request or a database query, in a type-safe way with the least overhead possible. It is explicitly NOT intended for complex use cases like form validation (use [zod](https://www.npmjs.com/package/zod) or [joi](https://www.npmjs.com/package/joi) for those).

## Example

Here's how you might define a simple schema in lifeboat:

```ts
import ty, { ValidatedBy } from "lifeboat";

const userSchema = ty.object({
	name: ty.string(),
	age: ty.number(),
	friendList: ty.array(ty.string())
});

// You can get access to the corresponding type like this:
type User = ValidatedBy<typeof userSchema>;
```

`userSchema` now exposes two functions, `check` and `assert`:

```ts
// Returns true when `data` is of type User, and false otherwise.
// Functions as a type guard.
const isUser = userSchema.check(data);

// Throws an error when `data` is not of type User.
// Functions as a type assertion.
userSchema.assert(data);
```

## Reference

These are all validators lifeboat provides:

| Validator                                     | Type                                                               |
| --------------------------------------------- | ------------------------------------------------------------------ |
| **`ty.undefined()`**                          | `undefined`                                                        |
| **`ty.boolean()`**                            | `boolean`                                                          |
| **`ty.number()`**                             | `number`                                                           |
| **`ty.bigint()`**                             | `bigint`                                                           |
| **`ty.string()`**                             | `string`                                                           |
| **`ty.symbol()`**                             | `symbol`                                                           |
| **`ty.object(structure)`**                    | `object` with structure defined by `structure`, see example        |
| **`ty.array(itemValidator)`**                 | `ValidatedBy<typeof itemValidator>[]`                              |
| **`ty.optional(validator)`**                  | `ValidatedBy<typeof validator> \| undefined`                       |
| **`ty.nullable(validator)`**                  | `ValidatedBy<typeof validator> \| null`                            |
| **`ty.allowNullish(validator)`**              | `ValidatedBy<typeof validator> \| null \| undefined`               |
| **`ty.union(validatorA, validatorB)`**        | `ValidatedBy<typeof validatorA> \| ValidatedBy<typeof validatorB>` |
| **`ty.intersection(validatorA, validatorB)`** | `ValidatedBy<typeof validatorA> & ValidatedBy<typeof validatorB>`  |
| **`ty.equals(value)`**                        | Only matches values that are strictly equal to `value` (see below) |
| **`ty.stringUnion(...values)`**               | Union of the provided strings (see below)                          |

### `ty.equals(value)`

This validator matches only values that are exaclty equal to `value`.

In order for type checking to work correctly here, be sure to always use `as const` like this:

```ts
const schema = ty.equals(123 as const);
```

### `ty.stringUnion(...values)`

This validator exists to support the common pattern of using string unions as enums.

For example, in order to encode a type like `"abc" | "def" | "ghi"`, you would use:

```ts
const schema = ty.stringUnion("abc", "def", "ghi");
```
