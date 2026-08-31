import type { Faker } from "@faker-js/faker";
import type mongoose from "mongoose";
import type { AnyObject, Model, Schema, Types } from "mongoose";

export type Instance = FieldConstraints["type"];

export type SchemaConstraints = Record<string, FieldConstraints>;

export type FieldConstraints =
  | StringConstraints
  | NumberConstraints
  | DateConstraints
  | BufferConstraints
  | BooleanConstraints
  | ObjectIdConstraints
  | ArrayConstraints
  | Decimal128Constraints
  | MapConstraints
  | EmbeddedConstraints
  | UUIDConstraints
  | BigIntConstraints
  | DoubleConstraints
  | Int32Constraints
  | MixedConstraints;

interface AbstractConstraints<T> {
  path: string;
  default?: T | (() => T);
  required?: boolean | (() => boolean);
  set?: (value: any) => any;
}

export interface StringConstraints extends AbstractConstraints<string> {
  type: "String";
  enum?: string[];
  minlength?: number;
  maxlength?: number;
  match?: RegExp;
  trim?: boolean;
  lowercase?: boolean;
  uppercase?: boolean;
}

export interface NumberConstraints extends AbstractConstraints<number> {
  type: "Number";
  min?: number;
  max?: number;
  enum?: number[];
}

export interface DateConstraints extends AbstractConstraints<Date> {
  type: "Date";
  min?: Date;
  max?: Date;
}

export interface BufferConstraints extends AbstractConstraints<Buffer> {
  type: "Buffer";
}

export interface BooleanConstraints extends AbstractConstraints<boolean> {
  type: "Boolean";
}

export interface ObjectIdConstraints
  extends AbstractConstraints<Types.ObjectId> {
  type: "ObjectId";
  ref?: string | Model<any> | (() => string | Model<any>);
}

export interface ArrayConstraints
  extends AbstractConstraints<Types.Array<unknown>> {
  type: "Array";
  of: Instance | SchemaConstraints | ArrayConstraints;
  ref?: string | Model<any> | (() => string | Model<any>);
}

export interface Decimal128Constraints
  extends AbstractConstraints<Types.Decimal128> {
  type: "Decimal128";
}

export interface MapConstraints
  extends AbstractConstraints<Map<string, unknown>> {
  type: "Map";
  of: Instance | SchemaConstraints;
}

export interface EmbeddedConstraints extends AbstractConstraints<AnyObject> {
  type: "Embedded";
  schema: SchemaConstraints;
}

export interface UUIDConstraints extends AbstractConstraints<Types.UUID> {
  type: "UUID";
}

export interface BigIntConstraints extends AbstractConstraints<bigint> {
  type: "BigInt";
}

export interface DoubleConstraints extends AbstractConstraints<Types.Double> {
  type: "Double";
}

export interface Int32Constraints extends AbstractConstraints<number> {
  type: "Int32";
}

export interface MixedConstraints extends AbstractConstraints<any> {
  type: "Mixed";
}

export type LeanValue<T> =
  T extends Types.DocumentArray<infer U>
    ? LeanValue<U>[]
    : T extends Array<infer U>
      ? LeanValue<U>[]
      : T extends mongoose.Schema<any, any, any>
        ? LeanValue<mongoose.InferSchemaType<T>>
        : T extends Map<infer K, infer V>
          ? Record<K extends PropertyKey ? K : never, LeanValue<V>>
          : T extends typeof Schema.Types.Mixed
            ? any
            : T extends
                  | Date
                  | Types.ObjectId
                  | Buffer
                  | mongoose.mongo.Binary
                  | Types.Decimal128
                  | typeof Schema.Types.UUID
                  | BigInt
                  | Types.Double
                  | typeof Schema.Types.Int32
              ? T
              : T extends AnyObject
                ? ExtractObjectWithoutIndexSignature<{
                    [K in keyof T as K extends "_id" | "__v"
                      ? never
                      : K]: LeanValue<T[K]>;
                  }>
                : T;

export type GeneratorFn<T> = (faker: Faker) => LeanValue<T>;

type ExtractObjectWithoutIndexSignature<T> = T extends any
  ? [keyof T] extends [never]
    ? never
    : string extends keyof T
      ? never
      : T
  : never;

export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};
