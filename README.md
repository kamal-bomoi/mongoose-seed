# Mongoose Seed

A powerful utility for seeding Mongoose models with realistic fake data using Faker.js.

Perfect for testing, development, and populating your database with mock data.

## Features

- Faker-powered data generation
- Supports all Mongoose schema types
- Fully respects your Mongoose schema options (e.g., `required`, `default`, `enum`, `min`, `max`, etc.)
- Handles complex nested structures, Maps, arrays, and embedded documents
- Supports automatic and custom timestamp generation
- Includes debug mode with memory tracking and progress logging
- Realistic data based on model and field names
- Customizable field generators
- Automatic resolution of ObjectId references (including arrays of references)

## Installation

```bash
npm install @kamalyb/mongoose-seed -D

# or

yarn add @kamalyb/mongoose-seed -D

# or

pnpm add @kamalyb/mongoose-seed -D
```

## Usage

### Basic Usage

```typescript
import mongoose from "mongoose";
import { seed } from "@kamalyb/mongoose-seed";

const schema = new mongoose.Schema(
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
    versionKey: false,
    timestamps: {
      createdAt: "inserted_at",
      updatedAt: true
    }
  }
);

const Test = mongoose.model("Test", schema);

await mongoose.connect();

await seed(Test, {
  quantity: 5000 // or within range [1000, 5000],
  clean: true, // Remove existing documents before seeding
  debug: false, // Log progress and performance information
  spinner: true, // Show ora spinners (set to false when running in parallel)
  exclude: ["mixed"], // Fields to exclude
  timestamps: true, // Generate random timestamps or let mongoose generate as it normally would
  optional_field_probability: 0.8, // 80% chance that optional fields will be included
  generators: { // Custom generators for specific fields
    num: (faker) => Math.random(),
    timestamps: (faker, doc) => {
      const at = doc.date
        ? faker.date.past({ refDate: doc.date })
        : faker.date.anytime();

      return {
        inserted_at: at,
        updatedAt: at
      }
    }
  }
});

await mongoose.disconnect();
```

### Custom Generator Precedence

A custom generator for a path always wins: it takes precedence over the
schema `default` for that path, and it is not subject to
`optional_field_probability` (it fills 100% of documents). Fields without a
custom generator keep the default behavior: schema defaults apply, then
optional fields are included randomly per `optional_field_probability`.
Mongoose setters (e.g. `uppercase`, `trim`) still apply to custom values.

### Handling Model References

When your models reference other models via ObjectId fields, the seeder automatically handles this through an internal registry system. Here's how it works:

```typescript
import mongoose from "mongoose";
import { seed } from "@kamalyb/mongoose-seed";

const UserSchema = new mongoose.Schema({
  name: String,
  email: String,
  role: String
});

const User = mongoose.model("User", UserSchema);

const PostSchema = new mongoose.Schema({
  title: String,
  content: String,
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  contributors: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  ]
});

const Post = mongoose.model("Post", PostSchema);

await mongoose.connect();

await seed(User, {
  quantity: 50,
  clean: true
});

await seed(Post, {
  quantity: 100,
  clean: true
});

await mongoose.disconnect();
```

**How it works:**

1. When you seed the `User` model, all generated user ids are cached in an internal registry (within the current node process)
2. When you seed the `Post` model:
   - The seeder detects that `author` field references a User (via the `ref` property)
   - It checks the internal registry cache for user ids
   - It randomly selects from the cached user ids for each post
   - For array fields like `contributors`, it randomly selects multiple user ids
3. If a referenced model wasn't seeded in the current node process, the seeder will automatically query the database to load existing documents from that collection

As long as you seed referenced models first within the same process, the seeder uses cached ids.

## Behaviors

1. Documents are inserted into the database using `Model.insertyMany()`.

## Caveats

### Field functions and `this` context

In the seeding context, if a field's `default` or `required` is a function,
`this` refers to a plain JavaScript object (POJO), unlike in regular Mongoose
usage where `this` would be a Mongoose document.

### `default: null` with sparse unique indexes

MongoDB sparse indexes skip documents where the field is missing, but they
still index explicit `null` values. A schema path declared as
`{ unique: true, sparse: true }` with `default: null` will therefore throw
`E11000 duplicate key` as soon as two documents leave the field unset. Prefer
omitting the default (so unset fields stay absent) or supply a custom
generator that always returns a unique value.

### Bulk Write Error – "offset is out of range"

If you encounter this error: `The value of "offset" is out of range. It must be >= 0 && <= 17825792.`,
this means the total size of the bulk insert exceeded MongoDB's BSON buffer limit.
This typically happens when seeding a large number of complex or deeply nested documents.
The error is **not caused by this package** but is related to MongoDB's inherent
limitations and internal mechanics for handling bulk writes.

To resolve this, try reducing the quantity parameter to a smaller value — 5,000–10,000
is often a safe range for complex documents. For very large datasets with deeply
nested structures, consider making multiple calls to the `seed()` function,
each with a smaller quantity, to stay within the BSON size limits.

### Parallel seeding and spinner warnings

When running multiple `seed()` calls in parallel (e.g. via `Promise.all`), ora may
output warnings like:

> [ora] Multiple concurrent spinners detected. This may cause visual corruption. Use one spinner at a time.

To avoid this, disable spinners by setting `spinner: false` in the seed config:

```typescript
await Promise.all([
  seed(ModelA, { quantity: 1000, spinner: false }),
  seed(ModelB, { quantity: 1000, spinner: false })
]);
```

When `spinner` is not set, it defaults to `true` (spinners enabled).
