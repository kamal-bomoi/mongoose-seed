import mongoose from "mongoose";
import { seed } from "./src/seeder.js";

const Stuff = mongoose.model(
  "Stuff",
  new mongoose.Schema(
    {
      str: {
        type: String
      },
      num: {
        type: Number,
        required: () => true
      },
      date: {
        type: Date,
        required: true
      },
      bool: Boolean,
      oid: mongoose.Schema.Types.ObjectId,
      buffer: mongoose.Schema.Types.Buffer,
      dec128: mongoose.Schema.Types.Decimal128,
      uuid: mongoose.Schema.Types.UUID,
      bigint: mongoose.Schema.Types.BigInt,
      double: mongoose.Schema.Types.Double,
      int32: mongoose.Schema.Types.Int32,
      schema: new mongoose.Schema(
        {
          num: Number,
          email: {
            type: String
          },
          username: {
            type: String
          }
        },
        { _id: false }
      ),
      array: [
        new mongoose.Schema({
          node: {
            type: Number,
            required: true,
            min: 1,
            max: 10
          },
          word: String,
          name: String,
          email: String,
          phone: String,
          address: String
        })
      ],
      map: {
        type: Map,
        of: {
          name: Number,
          email: String,
          address: Date,
          active: Boolean
        }
      },
      mixed: mongoose.Schema.Types.Mixed
    },
    {
      versionKey: false
    }
  )
);

const Person = mongoose.model(
  "Person",
  new mongoose.Schema({
    name: {
      type: String,
      required: true
    }
  })
);

await mongoose.connect("mongodb://localhost:27017/mongoose-seed");

try {
  await Promise.all([
    seed(Stuff, {
      quantity: [100, 1000],
      clean: true,
      exclude: [],
      debug: false,
      timestamps: true,
      optional_field_probability: 0.5,
      generators: {},
      spinner: false
    }),

    seed(Person, {
      quantity: [100, 1000],
      clean: true,
      exclude: [],
      debug: false,
      timestamps: true,
      spinner: false
    })
  ]);
} catch (e) {
  const error = e as Error;

  console.error({ error: error.message });
} finally {
  await mongoose.disconnect();
}
