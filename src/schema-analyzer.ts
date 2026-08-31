import { type AnyObject, Schema } from "mongoose";
import type { ArrayConstraints, SchemaConstraints } from "./types.js";

export interface AnalyzerOptions<T> {
  exclude?: (keyof T)[];
}

export class SchemaAnalyzer<T> {
  #main: Schema;

  #exclude: string[] = ["_id", "__v"];

  labels: {
    timestamps: {
      created?: string;
      updated?: string;
    };
  };

  constructor(schema: Schema, { exclude }: AnalyzerOptions<T> = {}) {
    this.#main = schema;

    this.labels = {
      timestamps: this.extract_timestamp_labels(this.#main)
    };

    if (exclude?.length) this.#exclude = this.#exclude.concat(exclude as any);
  }

  constraints(schema: Schema): SchemaConstraints {
    const constraint: AnyObject = {};

    schema.eachPath((path, type) => {
      if (this.#exclude.includes(path) || path.includes(".$*")) return;

      const options = type.options;

      const required = Array.isArray(options.required)
        ? options.required[0]
        : options.required;

      if (type.instance === "Embedded")
        constraint[path] = {
          path,
          type: type.instance,
          default: options.default,
          required,
          set: options.set,
          schema: this.constraints((type as any).schema)
        };
      else if (type.instance === "Array") {
        // In Mongoose v9, use embeddedSchemaType instead of caster
        const embedded_schema_type = (type as AnyObject).embeddedSchemaType;

        if (embedded_schema_type.schema)
          // Array of documents
          constraint[path] = {
            path,
            type: type.instance,
            required,
            default: options.default,
            set: options.set,
            of: this.constraints(embedded_schema_type.schema)
          };
        else if (embedded_schema_type.instance === "Array")
          // Nested array (e.g., [[Number]])
          constraint[path] = {
            path,
            type: type.instance,
            required,
            default: options.default,
            set: options.set,
            of: this.#nested_array(embedded_schema_type)
          };
        else {
          constraint[path] = {
            path,
            type: type.instance,
            required,
            set: options.set,
            of: embedded_schema_type.instance,
            ref:
              embedded_schema_type.instance === "ObjectId" &&
              embedded_schema_type.options.ref
                ? embedded_schema_type.options.ref
                : undefined
          };
        }
      } else if (type.instance === "Map") {
        const inner = (type as AnyObject).$__schemaType;

        let oftype: any;

        if (inner.schema instanceof Schema)
          oftype = this.constraints(inner.schema);
        else oftype = inner.instance;

        constraint[path] = {
          path,
          type: "Map",
          required,
          default: options.default,
          set: options.set,
          of: oftype
        };
      } else if (type.instance === "String")
        constraint[path] = {
          path,
          type: type.instance,
          default: options.default,
          required,
          set: options.set,
          trim: options.trim,
          lowercase: options.lowercase,
          uppercase: options.uppercase,
          enum: options.enum
            ? Array.isArray(options.enum)
              ? options.enum
              : options.enum.values
            : undefined,
          match: options.match
            ? Array.isArray(options.match)
              ? options.match[0]
              : options.match
            : undefined,
          minlength:
            options.minlength !== undefined
              ? Array.isArray(options.minlength)
                ? options.minlength[0]
                : options.minlength
              : undefined,
          maxlength:
            options.maxlength !== undefined
              ? Array.isArray(options.maxlength)
                ? options.maxlength[0]
                : options.maxlength
              : undefined
        };
      else if (type.instance === "Number")
        constraint[path] = {
          path,
          type: type.instance,
          default: options.default,
          required,
          set: options.set,
          min:
            options.min !== undefined
              ? Array.isArray(options.min)
                ? options.min[0]
                : options.min
              : undefined,
          max:
            options.max !== undefined
              ? Array.isArray(options.max)
                ? options.max[0]
                : options.max
              : undefined,
          enum: options.enum
            ? Array.isArray(options.enum)
              ? options.enum
              : options.enum.values
            : undefined
        };
      else if (type.instance === "Date")
        constraint[path] = {
          path,
          type: type.instance,
          default: options.default,
          required,
          set: options.set,
          min:
            options.min !== undefined
              ? Array.isArray(options.min)
                ? options.min[0]
                : options.min
              : undefined,
          max:
            options.max !== undefined
              ? Array.isArray(options.max)
                ? options.max[0]
                : options.max
              : undefined
        };
      else if (type.instance === "ObjectId")
        constraint[path] = {
          path,
          type: type.instance,
          default: options.default,
          required,
          set: options.set,
          ref: options.ref
        };
      else
        constraint[path] = {
          path,
          type: type.instance,
          default: options.default,
          set: options.set,
          required
        };
    });

    return constraint;
  }

  extract_timestamp_labels(schema: Schema): {
    created?: string;
    updated?: string;
  } {
    const options = schema.get("timestamps");

    if (options === true)
      return {
        created: "createdAt",
        updated: "updatedAt"
      };

    if (!options) return {};

    const fields: { created?: string; updated?: string } = {};

    if (typeof options.createdAt === "string")
      fields.created = options.createdAt;
    else if (options.createdAt === true) fields.created = "createdAt";

    if (typeof options.updatedAt === "string")
      fields.updated = options.updatedAt;
    else if (options.updatedAt === true) fields.updated = "updatedAt";

    return fields;
  }

  is_timestamp_field(path: string): boolean {
    return (
      this.labels.timestamps.created === path ||
      this.labels.timestamps.updated === path
    );
  }

  #nested_array(embedded_schema_type: AnyObject) {
    const nested = embedded_schema_type.embeddedSchemaType;
    const constraint: ArrayConstraints = {
      type: "Array",
      path: nested.path,
      of: nested.instance
    };

    if (nested.schema)
      // Array of documents
      constraint.of = this.constraints(nested.schema);
    else if (nested.instance === "Array")
      // Further nested array (e.g., [[[String]]])
      constraint.of = this.#nested_array(nested) as any;

    return constraint;
  }
}
