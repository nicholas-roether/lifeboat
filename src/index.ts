/**
 * **NOTE**: This type should not be thrown.
 *
 * An object that holds information about why a particular value was not accepted
 * by a validator.
 */
class ValidationError {
	private readonly problem: string;
	private readonly path: string[];

	constructor(problem: string, path: string[] = []) {
		this.problem = problem;
		this.path = path;
	}

	/**
	 * A human-readable error message explaining the reason why the value wasn't accepted by the validator.
	 */
	public get message(): string {
		let message = this.problem;
		if (this.path.length > 0) message += ` ($${this.path.join("")})`;

		return message;
	}

	public wrapPath(...outerPath: string[]) {
		return new ValidationError(this.problem, [...outerPath, ...this.path]);
	}
}

/**
 * The error that is thrown when a call to `assert` on a `Validator` fails.
 */
class ValidationAssertionError extends Error {
	constructor(err: ValidationError, context: string) {
		super(`${context}: ${err.message}`);
	}
}

type ValidationResultErr = { valid: false; error: ValidationError };
type ValidationResultOk = { valid: true };

/**
 * The result of a validation. It has two fields; `valid`, a boolean, shows whether the value was accepted.
 * If not, `error` contains the reason why not.
 */
type ValidationResult = ValidationResultOk | ValidationResultErr;

function valid(): ValidationResultOk {
	return { valid: true };
}

function invalid(error: ValidationError): ValidationResultErr {
	return { valid: false, error };
}

/**
 * A validator that accepts values of type T.
 */
abstract class Validator<T> {
	private lastError: ValidationError | null = null;

	public abstract validate(val: unknown): ValidationResult;

	public get reason(): string {
		return this.lastError?.message ?? "Unknown reason";
	}

	/**
	 * Don't call this method directly, use the global function `checkType` instead
	 */
	public _check(val: unknown, onError?: (err: string) => void): val is T {
		this.lastError = null;
		const res = this.validate(val);
		if (!res.valid) {
			this.lastError = res.error;
			onError?.(res.error.message);
		}
		return res.valid;
	}

	/**
	 * Don't call this method directly, use the global function `assertType` instead
	 */
	public _assert(val: unknown, context?: string): asserts val is T {
		this.lastError = null;
		const res = this.validate(val);
		if (!res.valid) {
			this.lastError = res.error;
			throw new ValidationAssertionError(
				res.error,
				context ?? "Type assertion failed"
			);
		}
	}
}

function valueDescriptor(value: unknown) {
	if (value === null) return "null";
	return `type ${typeof value}`;
}

class UnknownValidator extends Validator<unknown> {
	public validate(): ValidationResult {
		return valid();
	}
}

class ExactValidator<T> extends Validator<T> {
	private value: T;

	constructor(value: T) {
		super();
		this.value = value;
	}

	public validate(val: unknown): ValidationResult {
		if (val === this.value) return valid();
		return invalid(
			new ValidationError(
				`Expected ${JSON.stringify(this.value)}, found ${JSON.stringify(val)}`
			)
		);
	}
}

class StringUnionValidator<T extends string> extends Validator<T> {
	private values: readonly string[];

	constructor(...values: readonly T[]) {
		super();
		this.values = values;
	}

	public validate(val: unknown): ValidationResult {
		if (typeof val !== "string" || !this.values.includes(val)) {
			return invalid(
				new ValidationError(
					`Expected one of [${this.values
						.map((v) => JSON.stringify(v))
						.join(", ")}], found ${JSON.stringify(val)}`
				)
			);
		}
		return valid();
	}
}

class SimpleValidator<T> extends Validator<T> {
	private typeStr: string;

	constructor(typeStr: string) {
		super();
		this.typeStr = typeStr;
	}

	public validate(val: unknown): ValidationResult {
		if (typeof val === this.typeStr) return valid();
		return invalid(
			new ValidationError(
				`Expected type ${this.typeStr}, found ${valueDescriptor(val)}`
			)
		);
	}
}

type BasicObject = Record<string | number | symbol, unknown>;

type ObjectStructure<T> = {
	[K in keyof T]: Validator<T[K]>;
};

class ObjectValidator<T extends BasicObject> extends Validator<T> {
	private readonly structure: ObjectStructure<T>;

	constructor(structure: ObjectStructure<T>) {
		super();
		this.structure = structure;
	}

	public validate(val: unknown): ValidationResult {
		if (typeof val !== "object" || val === null) {
			return invalid(
				new ValidationError(`Expected an object, found ${valueDescriptor(val)}`)
			);
		}
		for (const key in this.structure) {
			if (!(key in val)) {
				return invalid(
					new ValidationError(`Missing required property "${key}"`)
				);
			}
			const res = this.structure[key].validate(
				(val as Record<string, unknown>)[key]
			);
			if (!res.valid) return invalid(res.error.wrapPath(`.${key}`));
		}
		return valid();
	}
}

class ArrayValidator<T> extends Validator<T[]> {
	private readonly itemValidator: Validator<T>;

	constructor(itemValidator: Validator<T>) {
		super();
		this.itemValidator = itemValidator;
	}

	public validate(val: unknown): ValidationResult {
		if (!Array.isArray(val)) {
			return invalid(
				new ValidationError(`Expected an array, found ${valueDescriptor(val)}`)
			);
		}
		for (let i = 0; i < val.length; i++) {
			const res = this.itemValidator.validate(val[i]);
			if (res.valid) continue;
			return invalid(res.error.wrapPath(`[${i}]`));
		}
		return valid();
	}
}

class UnionValidator<A, B> extends Validator<A | B> {
	private readonly validator1: Validator<A>;
	private readonly validator2: Validator<B>;

	constructor(validator1: Validator<A>, validator2: Validator<B>) {
		super();
		this.validator1 = validator1;
		this.validator2 = validator2;
	}

	public validate(val: unknown): ValidationResult {
		const res1 = this.validator1.validate(val);
		if (res1.valid) return valid();
		const res2 = this.validator2.validate(val);
		if (res2.valid) return valid();
		return invalid(
			new ValidationError(
				`No validators were satisfied (${res1.error.message}; ${res2.error.message})`
			)
		);
	}
}

class IntersectionValidator<A, B> extends Validator<A & B> {
	private readonly validator1: Validator<A>;
	private readonly validator2: Validator<B>;

	constructor(validator1: Validator<A>, validator2: Validator<B>) {
		super();
		this.validator1 = validator1;
		this.validator2 = validator2;
	}

	public validate(val: unknown): ValidationResult {
		const res1 = this.validator1.validate(val);
		if (!res1.valid) return res1;
		const res2 = this.validator2.validate(val);
		if (!res2.valid) return res2;
		return valid();
	}
}

class NullableValidator<T> extends Validator<T | null> {
	private readonly validator: Validator<T>;

	constructor(validator: Validator<T>) {
		super();
		this.validator = validator;
	}

	public validate(val: unknown): ValidationResult {
		if (val === null) return valid();
		return this.validator.validate(val);
	}
}

class OptionalValidator<T> extends Validator<T | undefined> {
	private readonly validator: Validator<T>;

	constructor(validator: Validator<T>) {
		super();
		this.validator = validator;
	}

	public validate(val: unknown): ValidationResult {
		if (val === undefined) return valid();
		return this.validator.validate(val);
	}
}

class InstanceOfValidator<T> extends Validator<T> {
	private readonly Class: new (...args: unknown[]) => T;

	constructor(Class: new (...args: unknown[]) => T) {
		super();
		this.Class = Class;
	}

	public validate(val: unknown): ValidationResult {
		if (val instanceof this.Class) return valid();

		const actualConstructor = val?.constructor?.name;
		if (actualConstructor) {
			return invalid(
				new ValidationError(
					`Expected instance of ${this.Class.name}, found instance of ${actualConstructor}`
				)
			);
		} else {
			return invalid(
				new ValidationError(
					`Expected instance of ${this.Class.name}, found ${val}`
				)
			);
		}
	}
}

type ValidatedBy<V> = V extends Validator<infer T> ? T : never;

/**
 * The namespace of all supported type validators.
 * See <https://github.com/nicholas-roether/lifeboat> for a list.
 */
const ty = {
	/**
	 * @returns A validator that accepts only `undefined`.
	 */
	undefined(): Validator<undefined> {
		return new SimpleValidator("undefined");
	},
	/**
	 * @returns A validator that accepts only booleans.
	 */
	boolean(): Validator<boolean> {
		return new SimpleValidator("boolean");
	},
	/**
	 * @returns A validator that accepts only numbers.
	 */
	number(): Validator<number> {
		return new SimpleValidator("number");
	},
	/**
	 * @returns A validator that accepts only bigints.
	 */
	bigint(): Validator<bigint> {
		return new SimpleValidator("bigint");
	},
	/**
	 * @returns A validator that accepts only strings.
	 */
	string(): Validator<string> {
		return new SimpleValidator("string");
	},
	/**
	 * @returns A validator that accepts anything.
	 */
	unknown(): Validator<unknown> {
		return new UnknownValidator();
	},
	/**
	 * @returns A validator that accepts only symbols.
	 */
	symbol(): Validator<symbol> {
		return new SimpleValidator("symbol");
	},
	/**
	 * This method allows you to create validators for object types with specific shapes,
	 * for example:
	 *
	 * ```ts
	 * const userSchema = ty.object({
	 *    name: ty.string(),
	 *    age: ty.number(),
	 *    friendList: ty.array(ty.string())
	 * })
	 * ```
	 *
	 * Note that validators created this way will never accept null. If you want to make a value
	 * nullable, do so explicitly using `ty.nullable`.
	 *
	 * @param structure The structure of the object type
	 * @returns A validator that accepts only objects with the specified structure
	 */
	object<T extends BasicObject>(structure: ObjectStructure<T>): Validator<T> {
		return new ObjectValidator(structure);
	},
	/**
	 * This method allows to create validators for array types, for example:
	 *
	 * ```ts
	 * const arrayOfNumbers = ty.array(ty.number())
	 * ```
	 *
	 * @param itemValidator The validator that the array items have to conform to
	 * @returns A validator that accepts only arrays with items of the specified type
	 */
	array<T>(itemValidator: Validator<T>): Validator<T[]> {
		return new ArrayValidator(itemValidator);
	},
	/**
	 * Makes a value optional, meaning that `undefined` is allowed in addition to the inner type.
	 *
	 * @param validator The validator for the inner type
	 * @returns A validator that accepts either `undefined`, or any type accepted by `validator`
	 */
	optional<T>(validator: Validator<T>): Validator<T | undefined> {
		return new OptionalValidator(validator);
	},
	/**
	 * Makes a value nullable, meaning that `null` is allowed in addition to the inner type.
	 *
	 * @param validator The validator for the inner type
	 * @returns A validator that accepts either `null`, or any type accepted by `validator`
	 */
	nullable<T>(validator: Validator<T>): Validator<T | null> {
		return new NullableValidator(validator);
	},
	/**
	 * Combines the functionality of `ty.nullable` and `ty.optional` to allow any nullish value
	 * (`null` or `undefined`) in addition to the inner type
	 *
	 * @param validator The validator for the inner type
	 * @returns A validator that accepts either `null`, `undefined`, or any type accepted by `validator`
	 */
	allowNullish<T>(validator: Validator<T>): Validator<T | null | undefined> {
		return ty.optional(ty.nullable(validator));
	},
	/**
	 * This method allows you to handle union types. For example, the type `string | number`
	 * would be represented like this:
	 *
	 * ```ts
	 * const stringOrNumber = ty.union(ty.string(), ty.number());
	 * ```
	 *
	 * **IMPORTANT**: If you are just representing unions of strings, consider using
	 * `ty.stringUnion` instead for more ergonomic usage and more meaningful error messages.
	 *
	 * @param validator1 The first type
	 * @param validator2 The second type
	 * @returns A validator that accepts a union of the first and the second type
	 */
	union<A, B>(
		validator1: Validator<A>,
		validator2: Validator<B>
	): Validator<A | B> {
		return new UnionValidator(validator1, validator2);
	},
	/**
	 * This method allows you to form type intersections. This is rarely useful in this library's
	 * indended use case, and you should probably avoid using it unless necessary.
	 *
	 * @param validator1 The first type
	 * @param validator2 The second type
	 * @returns A validator that accepts anything that both the first and second validator accept
	 */
	intersection<A, B>(
		validator1: Validator<A>,
		validator2: Validator<B>
	): Validator<A & B> {
		return new IntersectionValidator(validator1, validator2);
	},
	/**
	 * This method allows you to only accept exact values, for example:
	 *
	 * ```ts
	 * const only69 = ty.equals(69 as const);
	 * ```
	 *
	 * **IMPORTANT**: Note the use of `as const`; this is required to make the type inference work properly
	 *
	 * The validator producted this way uses strict equality (`===`) for its comparisons.
	 *
	 * @param value The exact value to match
	 * @returns A validator that accepts only `value` exactly.
	 */
	equals<T>(value: T): Validator<T> {
		return new ExactValidator(value);
	},
	/**
	 * This method allows you to accept string unions. For example, "abc" | "cde" | "def"
	 * would be represented like this:
	 *
	 * ```ts
	 * const stringUnion = ty.stringUnion("abc", "cde", "def");
	 * ```
	 *
	 * @param values All strings in the union
	 * @returns A validator that matches any string in `values`
	 */
	stringUnion<T extends string>(...values: readonly T[]): Validator<T> {
		return new StringUnionValidator(...values);
	},
	/**
	 * This method allows you to only accept objects that are an instace of a given class, for example:
	 *
	 * ```ts
	 * const onlyArrayBuffers: ty.instanceof(ArrayBuffer);
	 * ```
	 * @param Class The class the value should be an instance of
	 * @returns A validator that matches instances of `Class`
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	instanceof<T>(Class: new (...args: any[]) => T): Validator<T> {
		return new InstanceOfValidator(Class);
	}
};

/**
 * Returns `true` when `validator` accepts `value`, and `false` otherwise.
 *
 * @param validator The validator to use for validation
 * @param value The value to check
 * @param onError An optional callback that receives the validation error in case of a rejection
 * @returns A boolean indicating whether `validator` accepts `value`
 */
function checkType<T>(validator: Validator<T>, value: unknown): value is T;
/**
 * @deprecated
 */
function checkType<T>(
	validator: Validator<T>,
	value: unknown,
	onError?: (err: string) => void
): value is T;
function checkType<T>(
	validator: Validator<T>,
	value: unknown,
	onError?: (err: string) => void
): value is T {
	return validator._check(value, onError);
}

/**
 * Throws an error when `validator` doesn't accept `value`.
 *
 * @param validator The validator to use for validation
 * @param value The value to check
 * @param context Provide additional context for more useful error messages
 */
function assertType<T>(
	validator: Validator<T>,
	value: unknown,
	context?: string
): asserts value is T {
	validator._assert(value, context);
}

export default ty;

export { ValidationAssertionError, checkType, assertType };

export type {
	Validator,
	ValidatedBy,
	ValidationResult,
	ValidationResultOk,
	ValidationResultErr
};
