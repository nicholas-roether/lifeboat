class ValidationError {
	private readonly problem: string;
	private readonly path: string[];

	constructor(problem: string, path: string[] = []) {
		this.problem = problem;
		this.path = path;
	}

	public get message(): string {
		let message = this.problem;
		if (this.path.length > 0) message += ` ($${this.path.join("")})`;

		return message;
	}

	public wrapPath(...outerPath: string[]) {
		return new ValidationError(this.problem, [...outerPath, ...this.path]);
	}
}

class ValidationAssertionError extends Error {
	constructor(err: ValidationError, context: string) {
		super(`${context}: ${err}`);
	}
}

type ValidationResultErr = { valid: false; error: ValidationError };
type ValidationResultOk = { valid: true };

type ValidationResult = ValidationResultOk | ValidationResultErr;

function valid(): ValidationResultOk {
	return { valid: true };
}

function invalid(error: ValidationError): ValidationResultErr {
	return { valid: false, error };
}

abstract class Validator<T> {
	public abstract validate(val: unknown): ValidationResult;

	public check(val: unknown): val is T {
		return this.validate(val).valid;
	}

	public assert(val: unknown, context?: string): asserts val is T {
		const res = this.validate(val);
		if (!res.valid) {
			throw new ValidationAssertionError(
				res.error,
				context ?? "Validation assertion failed"
			);
		}
	}
}

function valueDescriptor(value: unknown) {
	if (value === null) return "null";
	return `type ${typeof value}`;
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
		for (const [key, value] of Object.entries(val as BasicObject)) {
			if (!(key in this.structure)) continue;
			const res = this.structure[key].validate(value);
			if (res.valid) continue;
			return invalid(res.error.wrapPath(`.${key}`));
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

type ValidatedBy<V> = V extends Validator<infer T> ? T : never;

const ty = {
	undefined(): Validator<undefined> {
		return new SimpleValidator("undefined");
	},
	boolean(): Validator<boolean> {
		return new SimpleValidator("boolean");
	},
	number(): Validator<number> {
		return new SimpleValidator("number");
	},
	bigint(): Validator<bigint> {
		return new SimpleValidator("bigint");
	},
	string(): Validator<string> {
		return new SimpleValidator("string");
	},
	symbol(): Validator<symbol> {
		return new SimpleValidator("symbol");
	},
	object<T extends BasicObject>(structure: ObjectStructure<T>): Validator<T> {
		return new ObjectValidator(structure);
	},
	array<T>(itemValidator: Validator<T>): Validator<T[]> {
		return new ArrayValidator(itemValidator);
	},
	optional<T>(validator: Validator<T>): Validator<T | undefined> {
		return new OptionalValidator(validator);
	},
	nullable<T>(validator: Validator<T>): Validator<T | null> {
		return new NullableValidator(validator);
	},
	allowNullish<T>(validator: Validator<T>): Validator<T | null | undefined> {
		return ty.optional(ty.nullable(validator));
	},
	union<A, B>(
		validator1: Validator<A>,
		validator2: Validator<B>
	): Validator<A | B> {
		return new UnionValidator(validator1, validator2);
	},
	intersection<A, B>(
		validator1: Validator<A>,
		validator2: Validator<B>
	): Validator<A & B> {
		return new IntersectionValidator(validator1, validator2);
	}
};

export default ty;

export { ValidationError, ValidationAssertionError };

export type {
	Validator,
	ValidatedBy,
	ValidationResult,
	ValidationResultOk,
	ValidationResultErr
};
