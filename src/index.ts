class ValidationError {
	private readonly problem: string;
	private readonly path: string[];

	constructor(problem: string, path: string[] = []) {
		this.problem = problem;
		this.path = path;
	}

	public get message(): string {
		return `[$${this.path.join("")}] ${this.problem}`;
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
				`Expected type ${this.typeStr}, found type ${typeof val}`
			)
		);
	}
}

type BasicObject = Record<string | number | symbol, unknown>;

type ObjectStructure<T> = {
	[K in keyof T]: Validator<T[K]>;
};

class ObjectValidator<T extends BasicObject> extends Validator<T> {
	private structure: ObjectStructure<T>;

	constructor(structure: ObjectStructure<T>) {
		super();
		this.structure = structure;
	}

	public validate(val: unknown): ValidationResult {
		if (typeof val !== "object") {
			return invalid(
				new ValidationError(`Expected an object, found type ${typeof val}`)
			);
		}
		if (val === null) {
			return invalid(new ValidationError("Value cannot be null"));
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
	private itemValidator: Validator<T>;

	constructor(itemValidator: Validator<T>) {
		super();
		this.itemValidator = itemValidator;
	}

	public validate(val: unknown): ValidationResult {
		if (!Array.isArray(val)) {
			return invalid(
				new ValidationError(`Expected an array, found type ${typeof val}`)
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
	}
};
