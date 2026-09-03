import { createHash, randomUUID } from "node:crypto";
import { type Faker, faker } from "@faker-js/faker";
import { type AnyObject, type Model, Types } from "mongoose";
import { registry } from "./registry.js";
import type { SchemaAnalyzer } from "./schema-analyzer.js";
import { contexts, generic } from "./string-matchers.js";
import type {
  ArrayConstraints,
  BigIntConstraints,
  BooleanConstraints,
  BufferConstraints,
  DateConstraints,
  Decimal128Constraints,
  DoubleConstraints,
  EmbeddedConstraints,
  FieldConstraints,
  GeneratorFn,
  Instance,
  Int32Constraints,
  LeanValue,
  MapConstraints,
  MixedConstraints,
  NumberConstraints,
  ObjectIdConstraints,
  SchemaConstraints,
  StringConstraints,
  UUIDConstraints
} from "./types.js";

export interface GeneratorOptions<T, U = Omit<T, "_id" | "__v">> {
  labels: {
    timestamps: {
      created?: string;
      updated?: string;
    };
  };
  timestamps?: boolean;
  optional_field_probability?: number;
  spinner?: boolean;
  generators?: {
    [K in keyof U]?: GeneratorFn<U[K]>;
  } & {
    timestamps?: (
      faker: Faker,
      doc: Partial<{ [Key in keyof U]: LeanValue<U[Key]> }>
    ) => Record<string, Date>;
  };
}

export class Generator<T> {
  #doc: AnyObject;

  #timestamp?: Date;

  #options: GeneratorOptions<T>;

  #model: Model<any>;

  #analyzer: SchemaAnalyzer<T>;

  constructor(
    model: Model<any>,
    analyzer: SchemaAnalyzer<T>,
    options: GeneratorOptions<T>
  ) {
    this.#model = model;
    this.#analyzer = analyzer;
    this.#doc = {};
    this.#options = options;
  }

  get timestamp_labels() {
    return this.#options.labels.timestamps;
  }

  async generate(constraints: SchemaConstraints): Promise<AnyObject> {
    for (const [path, constraint] of Object.entries(constraints))
      if (!this.#has_field_dependencies(constraint))
        this.#doc[path] = await this.#resolve_value(constraint);

    for (const [path, constraint] of Object.entries(constraints))
      if (this.#has_field_dependencies(constraint))
        this.#doc[path] = await this.#resolve_value(constraint);

    if (
      (this.#options.timestamps ?? true) &&
      Object.keys(this.timestamp_labels).length > 0
    )
      this.#resolve_timestamps();

    return this.#doc;
  }

  async #resolve_value(constraints: FieldConstraints) {
    const value = await this.#value(constraints);

    return constraints.set ? constraints.set(value) : value;
  }

  async #value(constraints: FieldConstraints) {
    if (this.#analyzer.is_timestamp_field(constraints.path)) return undefined;

    const custom_generator = (this.#options?.generators as AnyObject)?.[
      constraints.path
    ] as ((faker: Faker) => unknown) | undefined;

    if (custom_generator) return custom_generator(faker);

    if (constraints.default !== undefined)
      return this.#default_value(constraints);

    if (!this.#should_generate(constraints)) return undefined;

    switch (constraints.type) {
      case "String":
        return this.#string(constraints);
      case "Number":
        return this.#number(constraints);
      case "Boolean":
        return this.#boolean(constraints);
      case "Date":
        return this.#date(constraints);
      case "Buffer":
        return this.#buffer(constraints);
      case "Decimal128":
        return this.#decimal128(constraints);
      case "Double":
        return this.#double(constraints);
      case "Int32":
        return this.#int32(constraints);
      case "BigInt":
        return this.#bigint(constraints);
      case "ObjectId":
        return this.#objectid(constraints);
      case "UUID":
        return this.#uuid(constraints);
      case "Embedded":
        return this.#embedded(constraints);
      case "Array":
        return this.#array(constraints);
      case "Map":
        return this.#map(constraints);
      case "Mixed":
        return this.#mixed(constraints);
    }
  }

  #string(constraints: StringConstraints): string {
    if (constraints.enum) return faker.helpers.arrayElement(constraints.enum);

    if (constraints.match) return faker.helpers.fromRegExp(constraints.match);

    if (/(password|hash)/i.test(constraints.path))
      return this.#hash(constraints);

    const min = constraints.minlength ?? 1;
    const max = constraints.maxlength ?? 255;

    let value = this.#contextual_string_value(constraints.path);

    if (!value) value = this.#lorem(min, max);

    if (constraints.trim) value = value.trim();

    if (constraints.lowercase) value = value.toLowerCase();
    else if (constraints.uppercase) value = value.toUpperCase();

    return value;
  }

  #hash(constraints: StringConstraints): string {
    const min = constraints.minlength ?? 8;
    const max = constraints.maxlength ?? 128;

    const length = faker.number.int({ min, max });

    const password = faker.internet.password({ length });

    return createHash("sha256").update(password).digest("hex");
  }

  #number(constraints: NumberConstraints): number {
    if (constraints.enum) return faker.helpers.arrayElement(constraints.enum);

    if (constraints.min !== undefined || constraints.max !== undefined)
      return faker.number.int({
        min: constraints.min ?? Number.MIN_SAFE_INTEGER,
        max: constraints.max ?? Number.MAX_SAFE_INTEGER
      });

    let min = Number.MIN_SAFE_INTEGER;
    let max = Number.MAX_SAFE_INTEGER;
    let precision = 0;

    if (/age/i.test(constraints.path)) {
      min = 18;
      max = 90;
      precision = 0;
    } else if (/year/i.test(constraints.path)) {
      min = 1970;
      max = new Date().getFullYear();
      precision = 0;
    } else if (/(rating|score)/i.test(constraints.path)) {
      min = 1;
      max = 5;
      precision = 1;
    } else if (/(percent|percentage)/i.test(constraints.path)) {
      min = 0;
      max = 100;
      precision = 2;
    } else if (/(price|cost|amount)/i.test(constraints.path)) {
      min = 0.99;
      max = 999.99;
      precision = 2;
    } else if (/(quantity|count|stock)/i.test(constraints.path)) {
      min = 0;
      max = 100;
      precision = 0;
    } else if (/(weight)/i.test(constraints.path)) {
      min = 0.1;
      max = 100;
      precision = 2;
    } else if (/(height|width|length|depth)/i.test(constraints.path)) {
      min = 1;
      max = 200;
      precision = 1;
    } else if (/(latitude|lat)/i.test(constraints.path)) {
      min = -90;
      max = 90;
      precision = 6;
    } else if (/(longitude|long)/i.test(constraints.path)) {
      min = -180;
      max = 180;
      precision = 6;
    }

    return faker.number.float({ min, max, fractionDigits: precision });
  }

  #boolean(_constraints: BooleanConstraints): boolean {
    return faker.datatype.boolean();
  }

  #double(constraints: DoubleConstraints): number {
    let min = 0;
    let max = 100_000;
    let precision = 2;

    if (/(rating|score)/i.test(constraints.path)) {
      min = 1;
      max = 5;
      precision = 1;
    } else if (/(percent|percentage)/i.test(constraints.path)) {
      min = 0;
      max = 100;
      precision = 2;
    } else if (/(price|cost|amount)/i.test(constraints.path)) {
      min = 0.99;
      max = 999.99;
      precision = 2;
    } else if (/(quantity|count|stock)/i.test(constraints.path)) {
      min = 0;
      max = 100;
      precision = 0;
    } else if (/(weight)/i.test(constraints.path)) {
      min = 0.1;
      max = 100;
      precision = 2;
    } else if (/(height|width|length|depth)/i.test(constraints.path)) {
      min = 1;
      max = 200;
      precision = 1;
    } else if (/(latitude|lat)/i.test(constraints.path)) {
      min = -90;
      max = 90;
      precision = 6;
    } else if (/(longitude|long)/i.test(constraints.path)) {
      min = -180;
      max = 180;
      precision = 6;
    }

    return faker.number.float({ min, max, fractionDigits: precision });
  }

  #bigint(_constraints: BigIntConstraints): bigint {
    return BigInt(faker.number.int({ min: -1_000_000, max: 1_000_000 }));
  }

  #date(constraints: DateConstraints): Date {
    if (constraints.min || constraints.max)
      return faker.date.between({
        from: constraints.min ?? new Date(1970, 0, 1),
        to: constraints.max ?? new Date()
      });

    if (/(birth|dob)/i.test(constraints.path)) return faker.date.birthdate();

    if (/(expire|expiry|end)/i.test(constraints.path))
      return faker.date.soon({ days: 366 });

    if (/(deleted)/i.test(constraints.path))
      return faker.date.recent({ days: 14 });

    if (/(future|appointment|scheduled|upcoming)/i.test(constraints.path))
      return faker.date.soon({ days: 30 });

    if (/(past|previous)/i.test(constraints.path))
      return faker.date.past({ years: 2 });

    return faker.date.anytime();
  }

  #buffer(_constraints: BufferConstraints): Buffer {
    return Buffer.from(faker.lorem.word());
  }

  #decimal128(_constraints: Decimal128Constraints): Types.Decimal128 {
    return new Types.Decimal128(
      faker.number.float({ min: 1, max: 1_000_000 }).toString()
    );
  }

  #int32(_constraints: Int32Constraints): number {
    return faker.number.int({ min: -1_000_000, max: 1_000_000 });
  }

  async #objectid(constraints: ObjectIdConstraints): Promise<Types.ObjectId> {
    if (!constraints.ref) return new Types.ObjectId();

    const ref = this.#resolve_ref_model(constraints.ref);

    return await registry.single(this.#model, ref, this.#options.spinner);
  }

  #uuid(_constraints: UUIDConstraints) {
    return randomUUID();
  }

  async #embedded(constraints: EmbeddedConstraints) {
    const result: AnyObject = {};

    for (const [field, constraint] of Object.entries(constraints.schema))
      result[field] = await this.#value(constraint);

    return result;
  }

  async #array(constraints: ArrayConstraints): Promise<any[]> {
    const length = faker.number.int({ min: 1, max: 10 });

    if (constraints.ref)
      return await registry.multiple(
        this.#model,
        this.#resolve_ref_model(constraints.ref),
        length,
        this.#options.spinner
      );

    const items: any[] = [];

    for (let i = 0; i < length; i++) {
      if (typeof constraints.of !== "string" && constraints.of.type === "Array")
        items.push(await this.#array(constraints.of as ArrayConstraints));
      else if (typeof constraints.of === "string")
        items.push(
          await this.#value({
            path: constraints.path,
            type: constraints.of as any,
            required: constraints.required,
            default: constraints.default,
            ref: constraints.of === "ObjectId" ? constraints.ref : undefined
          })
        );
      else {
        const doc: AnyObject = {};

        for (const [field, constraint] of Object.entries(
          constraints.of as SchemaConstraints
        ))
          doc[field] = await this.#value(constraint);

        items.push(doc);
      }
    }

    return items;
  }

  async #map(constraints: MapConstraints) {
    const entries = faker.number.int({ min: 1, max: 5 });

    const obj: AnyObject = {};

    for (let i = 0; i < entries; i++) {
      const key = faker.word.sample();

      if (typeof constraints.of === "string")
        obj[key] = await this.#value({
          path: constraints.path,
          type: constraints.of as any,
          required: constraints.required
        });
      else {
        const entry: AnyObject = {};

        for (const [field, constraint] of Object.entries(constraints.of))
          entry[field] = await this.#value(constraint);

        obj[key] = entry;
      }
    }

    return obj;
  }

  async #mixed(constraints: MixedConstraints, depth = 0): Promise<any> {
    const primitives: Instance[] = [
      "String",
      "Number",
      "Boolean",
      "Date",
      "Buffer",
      "Decimal128",
      "Double",
      "Int32",
      "BigInt",
      "ObjectId",
      "UUID"
    ];

    if (depth >= 3)
      return await this.#value({
        path: constraints.path,
        type: faker.helpers.arrayElement(primitives) as any,
        required: true
      });

    const type = faker.helpers.arrayElement(["primitive", "array", "object"]);

    switch (type) {
      case "primitive":
        return await this.#value({
          path: constraints.path,
          type: faker.helpers.arrayElement(primitives) as any,
          required: true
        });

      case "array": {
        const length = faker.number.int({ min: 1, max: 3 });

        const items: any[] = [];

        for (let i = 0; i < length; i++)
          items.push(await this.#mixed(constraints, depth + 1));

        return items;
      }

      case "object": {
        const entries = faker.number.int({ min: 1, max: 3 });
        const obj: AnyObject = {};

        for (let i = 0; i < entries; i++)
          obj[faker.word.sample()] = await this.#mixed(constraints, depth + 1);

        return obj;
      }
    }
  }

  #contextual_string_value(path: string) {
    for (const { model_pattern, matchers } of contexts)
      if (model_pattern.test(this.#model.modelName))
        for (const [regex, generator] of matchers)
          if (regex.test(path)) return generator();

    for (const [regex, generator] of generic)
      if (regex.test(path)) return generator();
  }

  #should_generate(constraints: FieldConstraints): boolean {
    if (this.#analyzer.is_timestamp_field(constraints.path)) return true;

    if (typeof constraints.required === "function")
      return this.#evaluate_with_context(constraints.required);

    if (constraints.required === undefined || constraints.required === false)
      return faker.datatype.boolean({
        probability: this.#options?.optional_field_probability ?? 0.7
      });

    return constraints.required;
  }

  #default_value(constraints: FieldConstraints) {
    if (typeof constraints.default === "function")
      return this.#evaluate_with_context(constraints.default);

    return constraints.default;
  }

  #proxify_doc() {
    return new Proxy(this.#doc, {
      get: (target, prop, receiver) => Reflect.get(target, prop, receiver)
    });
  }

  #evaluate_with_context(value: Function) {
    return value.call(this.#proxify_doc());
  }

  #resolve_timestamps() {
    if (this.#options?.generators?.timestamps) {
      const fields = this.#options.generators.timestamps(
        faker,
        this.#proxify_doc() as any
      );

      if (
        this.timestamp_labels.created &&
        fields[this.timestamp_labels.created]
      )
        this.#doc[this.timestamp_labels.created] =
          fields[this.timestamp_labels.created];

      if (
        this.timestamp_labels.updated &&
        fields[this.timestamp_labels.updated]
      )
        this.#doc[this.timestamp_labels.updated] =
          fields[this.timestamp_labels.updated];
    } else if (this.#options?.timestamps) {
      const timestamp = this.#document_timestamp();

      if (this.timestamp_labels.created)
        this.#doc[this.timestamp_labels.created] = timestamp;

      if (this.timestamp_labels.updated)
        this.#doc[this.timestamp_labels.updated] = timestamp;
    }
  }

  #document_timestamp(): Date {
    if (!this.#timestamp)
      this.#timestamp = faker.date.between({
        from: new Date(1970, 0, 1),
        to: new Date()
      });

    return this.#timestamp;
  }

  #lorem(min: number, max: number): string {
    const length = faker.number.int({ min, max });

    let text = "";

    while (text.length < length) text += `${faker.lorem.paragraph()} `;

    return text.length > max ? text.substring(0, max) : text;
  }

  #has_field_dependencies(constraint: FieldConstraints): boolean {
    return (
      typeof constraint.default === "function" ||
      typeof constraint.required === "function"
    );
  }

  #resolve_ref_model(ref: NonNullable<ObjectIdConstraints["ref"]>): string {
    if (typeof ref === "function" && !("modelName" in ref))
      return this.#resolve_ref_model(ref.call(undefined));

    if (typeof ref === "string") return ref;

    return ref.modelName;
  }
}
