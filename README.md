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

With `userSchema` you can now use the two functions `checkType` and `assertType`:

```ts
import { checkType, assertType } from "lifeboat";

// Returns true when `data` is of type User, and false otherwise.
// Functions as a type guard.
const isUser = checkType(userSchema, data);

// Throws an error when `data` is not of type User.
// Functions as a type assertion.
assertType(userSchema, data);
```

When using `checkType`, you can get a message for why a value was rejected by using the
`reason` property of the schema, like so:

```ts
if (checkType(userSchema, data)) {
	// data is a User, do something with it
} else {
	console.error(`Not a valid user: ${userSchema.reason}`);
}
```

## Reference

### Primitive Types

Lifeboat exposes simple validators for primitive types:

| Validator            | Type        |
| -------------------- | ----------- |
| **`ty.undefined()`** | `undefined` |
| **`ty.boolean()`**   | `boolean`   |
| **`ty.number()`**    | `number`    |
| **`ty.bigint()`**    | `bigint`    |
| **`ty.string()`**    | `string`    |
| **`ty.symbol()`**    | `symbol`    |

### Objects

#### By structure

You can build an object validator by using `ty.object({ ... })`. The function takes an object as a paramter that specifies the object's structure, like this:

```ts
const exampleSchema = ty.object({
	id: ty.number(),
	name: ty.string()
});
```

By default, all properties are required and non-nullable. If you want optional or nullable values, specify them explicitly using `ty.optional`, `ty.nullable`, or `ty.allowNullish`:

```ts
const exampleSchema = ty.object({
	optionalVal: ty.optional(ty.string()), // string | undefined
	nullableVal: ty.nullable(ty.string()), // string | null
	valOrNullish: ty.allowNullish(ty.string()) // string | null | undefined
});
```

#### By class

You can also require that a value be an instance of a particular class, like `ArrayBuffer`, by using `ty.instanceof`.

```ts
const arrayBufferSchema = ty.instanceof(ArrayBuffer);
```

Like with the `instanceof` keyword, make sure that you know that the values you expect are actual instances of the class, not just POJOs with the class' structure; especially when your data is deserialized from a source like a network packet.

### Arrays

You can validate arrays by using `ty.array(...)`. This function takes another validator that will be used to validate the array's items as a parameter, like this:

```ts
const stringArraySchema = ty.array(ty.string()); // string[]
```

### Unknown types

Sometimes it can be useful to allow any type, for example when trying to validate that something is an array, without caring about the specific types. This can be done using `ty.unknown()`:

```ts
const unknownArray = ty.array(ty.unknown()); // unknown[]
```

### Enums

There are two kinds of enums that are supported; string unions (like "apple" | "tomato" | "pear"),
and const enums (i.e. number unions). You can validate them by using `ty.enum`.

```ts
const strEnum = ty.enum("apple", "tomato", "pear"); // "apple" | "tomato" | "pear"

// Yes, tomatoes are fruit, fight me
const enum Fruit {
	APPLE,
	TOMATO,
	PEAR
}

const constEnum = ty.enum(Fruit.APPLE, Fruit.TOMATO, Fruit.PEAR); // Fruit.APPLE | Fruit.TOMATO | Fruit.PEAR
```

### General Unions and Intersections

Although not recommended, as it makes for less readable error messages, general type unions and intersections are also supported:

```ts
// Unions
const stringOrNumber = ty.union(ty.string(), ty.number()); // string | number

// Intersections
const obj1Schema = ty.object(...); // Obj1
const obj2Schema = ty.object(...); // Obj2
const obj1And2 = ty.intersection(obj1Schema, obj2Schema); // Obj1 & Obj2
```

Note that both `ty.union` and `ty.intersection` currently only take two arguments, as opposed to `ty.stringUnion`. This is because in this general case, type inference doesn't seem to work as well.

### Exact Values

Sometimes it is useful to only allow precise values, particularly when working with unions. This can be done using `ty.equals(...)`:

```ts
const emptyStringSchema = ty.equals("" as const); // ""

const aCoolNumberSchema = ty.equals(69 as const); // 69
```

Note that `as const` is required here to make sure the type inference works correctly; without it, typescript would widen the types
of values like `""` and `69` to `string` and `number` respectively.
