import assert from "assert";
import ty, { Validator, assertType, checkType } from ".";

describe("ty.undefined", () => {
	it("allows `undefined`", () => {
		const schema = ty.undefined();

		const res = schema.validate(undefined);
		assert.strictEqual(res.valid, true);
	});

	it("disallows `null`", () => {
		const schema = ty.undefined();

		const res = schema.validate(null);
		assert.strictEqual(res.valid, false);
		assert.strictEqual(
			res.error.message,
			"Expected type undefined, found null"
		);
	});

	it("disallows `69`", () => {
		const schema = ty.undefined();

		const res = schema.validate(69);
		assert.strictEqual(res.valid, false);
		assert.strictEqual(
			res.error.message,
			"Expected type undefined, found type number"
		);
	});
});

function itDisallowsNullish<T>(schema: Validator<T>, expectation: string) {
	it("disallows `undefined`", () => {
		const res = schema.validate(undefined);
		assert.strictEqual(res.valid, false);
		assert.strictEqual(
			res.error.message,
			`${expectation}, found type undefined`
		);
	});

	it("disallows `null`", () => {
		const res = schema.validate(null);
		assert.strictEqual(res.valid, false);
		assert.strictEqual(res.error.message, `${expectation}, found null`);
	});
}

describe("ty.boolean", () => {
	it("allows `true`", () => {
		const schema = ty.boolean();

		const res = schema.validate(true);
		assert.strictEqual(res.valid, true);
	});

	it("allows `false`", () => {
		const schema = ty.boolean();

		const res = schema.validate(false);
		assert.strictEqual(res.valid, true);
	});

	itDisallowsNullish(ty.boolean(), "Expected type boolean");
});

describe("ty.number", () => {
	it("allows `69`", () => {
		const schema = ty.number();

		const res = schema.validate(69);
		assert.strictEqual(res.valid, true);
	});

	it('disallows `"abc"`', () => {
		const schema = ty.number();

		const res = schema.validate("abc");
		assert.strictEqual(res.valid, false);
		assert.strictEqual(
			res.error.message,
			"Expected type number, found type string"
		);
	});

	itDisallowsNullish(ty.number(), "Expected type number");
});

describe("ty.bigint", () => {
	it('allows `BigInt("1234")`', () => {
		const schema = ty.bigint();

		const res = schema.validate(BigInt("1234"));
		assert.strictEqual(res.valid, true);
	});

	it("disallows `69`", () => {
		const schema = ty.bigint();

		const res = schema.validate(69);
		assert.strictEqual(res.valid, false);
		assert.strictEqual(
			res.error.message,
			"Expected type bigint, found type number"
		);
	});

	itDisallowsNullish(ty.bigint(), "Expected type bigint");
});

describe("ty.string", () => {
	it('allows `"1234"`', () => {
		const schema = ty.string();

		const res = schema.validate("1234");
		assert.strictEqual(res.valid, true);
	});

	it("disallows `1234`", () => {
		const schema = ty.string();

		const res = schema.validate(1234);
		assert.strictEqual(res.valid, false);
		assert.strictEqual(
			res.error.message,
			"Expected type string, found type number"
		);
	});

	itDisallowsNullish(ty.string(), "Expected type string");
});

describe("ty.symbol", () => {
	it("allows `Symbol.asyncIterator`", () => {
		const schema = ty.symbol();

		const res = schema.validate(Symbol.asyncIterator);
		assert.strictEqual(res.valid, true);
	});

	it("disallows `1234`", () => {
		const schema = ty.symbol();

		const res = schema.validate(1234);
		assert.strictEqual(res.valid, false);
		assert.strictEqual(
			res.error.message,
			"Expected type symbol, found type number"
		);
	});

	itDisallowsNullish(ty.symbol(), "Expected type symbol");
});

describe("ty.object", () => {
	it("allows properly structured objects", () => {
		const schema = ty.object({
			val1: ty.number(),
			val2: ty.number()
		});

		const res = schema.validate({
			val1: 69,
			val2: 420
		});
		assert.strictEqual(res.valid, true);
	});

	it("disallows improperly structured objects", () => {
		const schema = ty.object({
			val1: ty.number(),
			val2: ty.number()
		});

		const res = schema.validate({
			val1: 69,
			val2: "420"
		});
		assert.strictEqual(res.valid, false);
		assert.strictEqual(
			res.error.message,
			"Expected type number, found type string ($.val2)"
		);
	});

	it("disallows objects with missing properties", () => {
		const schema = ty.object({
			val1: ty.number(),
			val2: ty.number()
		});

		const res = schema.validate({
			val1: 69
		});
		assert.strictEqual(res.valid, false);
		assert.strictEqual(res.error.message, 'Missing required property "val2"');
	});

	it("correctly formats deeply nested errors", () => {
		const schema = ty.object({
			val1: ty.number(),
			val2: ty.object({
				val3: ty.number()
			})
		});

		const res = schema.validate({
			val1: 69,
			val2: {
				val3: "420"
			}
		});
		assert.strictEqual(res.valid, false);
		assert.strictEqual(
			res.error.message,
			"Expected type number, found type string ($.val2.val3)"
		);
	});

	itDisallowsNullish(ty.object({}), "Expected an object");
});

describe("ty.array", () => {
	it("allows propery typed arrays", () => {
		const schema = ty.array(ty.number());

		const res = schema.validate([1, 2, 3]);
		assert.strictEqual(res.valid, true);
	});

	it("disallows improperly typed arrays", () => {
		const schema = ty.array(ty.number());

		const res = schema.validate([1, 2, "3"]);
		assert.strictEqual(res.valid, false);
		assert.strictEqual(
			res.error.message,
			"Expected type number, found type string ($[2])"
		);
	});

	it("disallows non-array values", () => {
		const schema = ty.array(ty.number());

		const res = schema.validate({});
		assert.strictEqual(res.valid, false);
		assert.strictEqual(
			res.error.message,
			"Expected an array, found type object"
		);
	});

	itDisallowsNullish(ty.array(ty.number()), "Expected an array");
});

describe("ty.optional", () => {
	it("allows `undefined`", () => {
		const schema = ty.optional(ty.number());

		const res = schema.validate(undefined);
		assert.strictEqual(res.valid, true);
	});

	it("disallows `null`", () => {
		const schema = ty.optional(ty.number());

		const res = schema.validate(null);
		assert.strictEqual(res.valid, false);
		assert.strictEqual(res.error.message, "Expected type number, found null");
	});

	it("allows the inner type", () => {
		const schema = ty.optional(ty.number());

		const res = schema.validate(69);
		assert.strictEqual(res.valid, true);
	});

	it("disallows unrelated types", () => {
		const schema = ty.optional(ty.number());

		const res = schema.validate("69");
		assert.strictEqual(res.valid, false);
		assert.strictEqual(
			res.error.message,
			"Expected type number, found type string"
		);
	});
});

describe("ty.nullable", () => {
	it("disallows `undefined`", () => {
		const schema = ty.nullable(ty.number());

		const res = schema.validate(undefined);
		assert.strictEqual(res.valid, false);
		assert.strictEqual(
			res.error.message,
			"Expected type number, found type undefined"
		);
	});

	it("allows `null`", () => {
		const schema = ty.nullable(ty.number());

		const res = schema.validate(null);
		assert.strictEqual(res.valid, true);
	});

	it("allows the inner type", () => {
		const schema = ty.nullable(ty.number());

		const res = schema.validate(69);
		assert.strictEqual(res.valid, true);
	});

	it("disallows unrelated types", () => {
		const schema = ty.nullable(ty.number());

		const res = schema.validate("69");
		assert.strictEqual(res.valid, false);
		assert.strictEqual(
			res.error.message,
			"Expected type number, found type string"
		);
	});
});

describe("ty.allowNullish", () => {
	it("allows `undefined`", () => {
		const schema = ty.allowNullish(ty.number());

		const res = schema.validate(undefined);
		assert.strictEqual(res.valid, true);
	});

	it("allows `null`", () => {
		const schema = ty.allowNullish(ty.number());

		const res = schema.validate(null);
		assert.strictEqual(res.valid, true);
	});

	it("allows the inner type", () => {
		const schema = ty.allowNullish(ty.number());

		const res = schema.validate(69);
		assert.strictEqual(res.valid, true);
	});

	it("disallows unrelated types", () => {
		const schema = ty.allowNullish(ty.number());

		const res = schema.validate("69");
		assert.strictEqual(res.valid, false);
		assert.strictEqual(
			res.error.message,
			"Expected type number, found type string"
		);
	});
});

describe("ty.union", () => {
	it("allows type 1", () => {
		const schema = ty.union(ty.string(), ty.number());

		const res = schema.validate("abc");
		assert.strictEqual(res.valid, true);
	});

	it("allows type 2", () => {
		const schema = ty.union(ty.string(), ty.number());

		const res = schema.validate(1234);
		assert.strictEqual(res.valid, true);
	});

	it("disallows other types", () => {
		const schema = ty.union(ty.string(), ty.number());

		const res = schema.validate(true);
		assert.strictEqual(res.valid, false);
		assert.strictEqual(
			res.error.message,
			"No validators were satisfied (Expected type string, found type boolean; Expected type number, found type boolean)"
		);
	});
});

describe("ty.intersection", () => {
	it("disallows type 1", () => {
		const schema = ty.intersection(ty.string(), ty.number());

		const res = schema.validate("abc");
		assert.strictEqual(res.valid, false);
		assert.strictEqual(
			res.error.message,
			"Expected type number, found type string"
		);
	});

	it("disallows type 2", () => {
		const schema = ty.intersection(ty.string(), ty.number());

		const res = schema.validate(1234);
		assert.strictEqual(res.valid, false);
		assert.strictEqual(
			res.error.message,
			"Expected type string, found type number"
		);
	});

	it("allows the intersection of both types", () => {
		const schema = ty.intersection(
			ty.object({ a: ty.number() }),
			ty.object({ b: ty.number() })
		);

		const res = schema.validate({ a: 1, b: 2 });
		assert.strictEqual(res.valid, true);
	});
});

describe("ty.equals", () => {
	it("allows the correct value", () => {
		const schema = ty.equals(2 as const);

		const res = schema.validate(2);
		assert.strictEqual(res.valid, true);
	});

	it("disallows incorrect values", () => {
		const schema = ty.equals(2 as const);

		const res = schema.validate(3);
		assert.strictEqual(res.valid, false);
		assert.strictEqual(res.error.message, "Expected 2, found 3");
	});
});

describe("ty.stringUnion", () => {
	it("allows correct values", () => {
		const schema = ty.stringUnion("a", "b");

		const res = schema.validate("a");
		assert.strictEqual(res.valid, true);
	});

	it("disallows incorrect values", () => {
		const schema = ty.stringUnion("a", "b");

		const res = schema.validate("c");
		assert.strictEqual(res.valid, false);
		assert.strictEqual(
			res.error.message,
			'Expected one of ["a", "b"], found "c"'
		);
	});
});

describe("checkType", () => {
	it("should return true for accepted values", () => {
		const schema = ty.string();

		const res = checkType(schema, "a");
		assert.strictEqual(res, true);
	});

	it("should return false for non-accepted values", () => {
		const schema = ty.string();

		const res = checkType(schema, 20);
		assert.strictEqual(res, false);
	});
});

describe("assertType", () => {
	it("should do nothing for accepted values", () => {
		const schema = ty.string();

		assert.doesNotThrow(() => assertType(schema, "a"));
	});

	it("should throw a proper error for non-accepted values", () => {
		const schema = ty.string();

		assert.throws(() => assertType(schema, 20), {
			message: "Type assertion failed: Expected type string, found type number"
		});
	});
});
