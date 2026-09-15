/**
 * Track 21 — Databases.
 *
 * Almost every system you build will be limited by its data layer long before
 * it is limited by its algorithms. This track covers the relational model and
 * SQL, then the two things practitioners actually get wrong: what an index
 * does, and what a transaction does not guarantee.
 */

import type { Track } from '../../domain/types';
import { categorize, codeOutput, concept, fill, interactive, lesson, match, mcq, multi, order, shortAnswer, trueFalse } from '../builders';

export const databasesTrack: Track = {
  id: 'track-databases',
  title: 'Databases',
  tagline: 'Modelling, querying, and not losing your data',
  description:
    'The relational model, SQL as set operations, what an index really costs, and what ACID does and does not promise. Ends with the analytical and distributed stores that machine-learning work actually runs on.',
  domain: 'databases',
  level: 'intro',
  icon: '🗃️',
  gradient: ['#6366F1', '#8B5CF6'],
  prerequisites: ['track-foundations'],
  outcomes: [
    'Design a normalised schema and justify where you denormalised',
    'Write and read joins, and predict which ones are expensive',
    'Explain when an index helps, when it is ignored, and what it costs on write',
    'Read a query plan and identify the scan that is hurting you',
    'Choose between a relational store, an analytical store, and a key-value store on the evidence',
  ],
  units: [
    // -----------------------------------------------------------------------
    {
      id: 'unit-db-1',
      title: 'Modelling Data',
      description: 'Tables, keys, and the discipline that keeps facts in one place.',
      lessons: [
        lesson({
          id: 'lesson-relational-model',
          title: 'Tables, Keys, and Normalisation',
          summary: 'One fact, one place. Every anomaly comes from breaking that rule.',
          level: 'intro',
          domain: 'databases',
          free: true,
          steps: [
            concept(
              'Relations, keys, and referential integrity',
              'The relational model is fifty years old and has outlasted every replacement announced for it. A **table** is a set of rows; each row is a fact; each column is an attribute of that fact.\n\nTwo kinds of key make the structure work:\n\nA **primary key** uniquely identifies a row. It is what lets you say "this row" without ambiguity.\n\nA **foreign key** is a column holding another table’s primary key. `orders.customer_id` references `customers.id`. The database *enforces* this: you cannot insert an order for a customer that does not exist, and you cannot delete a customer that still has orders (unless you say what should happen instead).\n\nThat enforcement is the point. The constraint lives in the schema, so it holds no matter which application, script, or intern writes to the table. Move it into application code and it holds only for the code paths that remembered it.\n\nRelationships come in three shapes: one-to-one (rare, usually a sign the tables should merge), one-to-many (a foreign key on the "many" side), and many-to-many (a **junction table** holding a pair of foreign keys — students and courses, posts and tags).',
              {
                keyTerms: [
                  { term: 'Primary key', definition: 'A column or set of columns uniquely identifying each row.' },
                  { term: 'Foreign key', definition: 'A reference to another table’s primary key, enforced by the database.' },
                ],
              },
            ),
            mcq(
              'How is a many-to-many relationship represented in a relational schema?',
              [
                'A comma-separated list in one column',
                'A junction table holding a foreign key to each side',
                'Two foreign keys in one of the two tables',
                'It cannot be represented',
              ],
              1,
              ['sk-relational-model'],
              'Students ↔ courses becomes an `enrolments` table with `student_id` and `course_id`. The junction row can carry its own attributes too — a grade, an enrolment date.',
            ),
            trueFalse(
              'A foreign key constraint is enforced by the database, not just by application code.',
              true,
              ['sk-relational-model'],
              'That is its value. A constraint in the schema cannot be bypassed by a script someone ran at 2am.',
            ),
            concept(
              'Normalisation: store each fact once',
              'Imagine one wide `orders` table that repeats the customer’s name and address on every order. Three failures follow immediately, and they have names:\n\n**Update anomaly.** The customer moves. Now you must find and change every row, and if you miss one the database holds two contradictory addresses and no way to tell which is right.\n\n**Insertion anomaly.** You cannot record a customer who has not ordered yet — there is no row to put them in.\n\n**Deletion anomaly.** Delete their last order and you have destroyed the customer record too.\n\n**Normalisation** is the fix: split the table so each fact lives in exactly one place. Customer details in `customers`, order details in `orders`, joined by `customer_id`. Now an address change is one row.\n\nThe working rule is third normal form: every non-key column depends on the key, the whole key, and nothing but the key.\n\nAnd then, sometimes, you **denormalise** deliberately — duplicating data to avoid a join on a hot read path. That is a legitimate engineering trade, but it is a trade: you have bought read speed with the obligation to keep copies in sync. Do it on purpose, with a note saying why, not by accident.',
              {
                keyTerms: [
                  { term: 'Normalisation', definition: 'Structuring tables so each fact is stored exactly once.' },
                  { term: 'Denormalisation', definition: 'Deliberately duplicating data to make reads cheaper.' },
                ],
              },
            ),
            match(
              'Match each anomaly to what goes wrong.',
              [
                { left: 'Update anomaly', right: 'One change must be applied in many rows, and a miss creates contradiction' },
                { left: 'Insertion anomaly', right: 'A fact cannot be recorded because no row exists to hold it' },
                { left: 'Deletion anomaly', right: 'Removing one record destroys unrelated information' },
                { left: 'Denormalisation', right: 'Duplication accepted on purpose to avoid a join' },
              ],
              ['sk-normalization'],
              'The three anomalies are all the same underlying problem: one fact stored in more than one place.',
            ),
            mcq(
              'A products table repeats the supplier’s address on every product row. What is the main risk?',
              [
                'The table uses more disk',
                'A supplier address change must touch every row, and any miss leaves the database self-contradictory',
                'Queries become slower',
                'The primary key becomes invalid',
              ],
              1,
              ['sk-normalization'],
              'Disk is cheap; disagreement is expensive. The danger is inconsistency, not size.',
            ),
            multi(
              'Which are legitimate reasons to denormalise?',
              [
                'A join on the read path is measurably too slow at your traffic',
                'It feels simpler to write',
                'The data is genuinely a point-in-time snapshot (an order stores the price *as charged*)',
                'You want to avoid learning SQL joins',
              ],
              [0, 2],
              ['sk-normalization'],
              'Measured performance, or a value that is genuinely historical rather than a duplicate. Convenience is not a reason.',
            ),
          ],
        }),
        lesson({
          id: 'lesson-sql-joins',
          title: 'SQL and Joins',
          summary: 'Declare what you want. The engine decides how.',
          level: 'intro',
          domain: 'databases',
          steps: [
            concept(
              'SQL is declarative set logic',
              'SQL is unusual among languages you will meet: you describe the result you want, not the procedure to compute it. The **query planner** chooses the procedure, and it may choose differently tomorrow as the data changes.\n\nThe clauses execute in an order that is not the order you write them:\n\n```\nFROM      which tables\nWHERE     filter individual rows\nGROUP BY  collapse rows into groups\nHAVING    filter the groups\nSELECT    choose output columns\nORDER BY  sort\nLIMIT     truncate\n```\n\nThat order explains two things that confuse everyone once. You cannot use a `SELECT` alias in `WHERE`, because `WHERE` ran first. And `WHERE` filters rows while `HAVING` filters groups — `WHERE amount > 100` drops individual orders, `HAVING SUM(amount) > 100` drops customers.\n\nOne trap worth knowing early: `NULL` is not a value but "unknown". `NULL = NULL` is not true, it is unknown. So `WHERE status = NULL` matches nothing, ever. You need `IS NULL`.',
              {
                keyTerms: [
                  { term: 'Declarative', definition: 'Describing the desired result rather than the steps to produce it.' },
                  { term: 'Query planner', definition: 'The component that chooses an execution strategy for a query.' },
                ],
              },
            ),
            mcq(
              'Why does `WHERE status = NULL` return no rows even when nulls exist?',
              [
                'NULL is not allowed in WHERE clauses',
                'NULL means unknown, so the comparison evaluates to unknown rather than true; you need IS NULL',
                'The column needs an index',
                'NULL must be quoted',
              ],
              1,
              ['sk-sql-queries'],
              'Three-valued logic. Unknown is not true, so the row is not returned.',
            ),
            fill(
              '`WHERE` filters individual ___, while `HAVING` filters ___.',
              [['rows', 'records'], ['groups', 'aggregates']],
              ['sk-sql-queries'],
              'WHERE runs before grouping, HAVING after. That is the whole distinction.',
            ),
            concept(
              'Joins: which rows survive',
              'A join combines rows from two tables on a condition. The join *type* answers one question: what happens to a row with no match?\n\n**INNER JOIN** — only matched rows survive. Customers with no orders vanish.\n\n**LEFT JOIN** — every left row survives; unmatched right columns are NULL. This is how you ask "all customers, with their orders if any".\n\n**FULL OUTER JOIN** — every row from both sides survives.\n\n**CROSS JOIN** — every pairing. n × m rows. Almost always an accident, usually caused by a forgotten `ON` clause.\n\nThe cost depends on the strategy the planner picks. A **nested loop** scans the right table for each left row — fine when one side is tiny. A **hash join** builds a hash table from the smaller side and probes it once per left row — good for large unindexed joins. A **merge join** needs both inputs sorted and then walks them in one pass.\n\nThe practical rule: join on indexed columns. Foreign keys are the usual join columns and are *not* automatically indexed in every database — PostgreSQL, for one, does not index them for you. That single omission is behind a large share of mysteriously slow queries.',
              {
                keyTerms: [
                  { term: 'Inner join', definition: 'Keeps only rows with a match on both sides.' },
                  { term: 'Left join', definition: 'Keeps every left row, filling unmatched right columns with NULL.' },
                ],
              },
            ),
            mcq(
              'You want every customer listed, including those who have never ordered. Which join?',
              ['INNER JOIN', 'LEFT JOIN from customers to orders', 'CROSS JOIN', 'RIGHT JOIN from customers to orders'],
              1,
              ['sk-joins'],
              'LEFT preserves every row of the left table; customers with no orders come back with NULL order columns.',
            ),
            codeOutput(
              'Table `a` has 5 rows, table `b` has 3 rows, and no row of `a` matches any row of `b`. How many rows does this return?',
              'pseudocode',
              'SELECT * FROM a LEFT JOIN b ON a.id = b.a_id;',
              ['0', '3', '5', '15'],
              2,
              ['sk-joins'],
              'All 5 left rows survive with NULL b-columns. An INNER JOIN would have returned 0, and a CROSS JOIN 15.',
            ),
            mcq(
              'A query joining two million-row tables is very slow. What should you check first?',
              [
                'Whether the server needs more RAM',
                'Whether the join columns are indexed',
                'Whether the tables are normalised',
                'Whether SELECT * is being used',
              ],
              1,
              ['sk-joins'],
              'Unindexed join columns force a scan of one side per row of the other. An index usually turns minutes into milliseconds.',
            ),
            trueFalse(
              'Foreign key columns are automatically indexed by every relational database.',
              false,
              ['sk-joins'],
              'PostgreSQL indexes the referenced primary key, not the referencing column. Forgetting this is a common source of slow joins and slow cascading deletes.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-db-1',
        title: 'Modelling Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'What problem does normalisation primarily solve?',
            ['Disk usage', 'Update anomalies and contradictory duplicate data', 'Query speed', 'Backup size'],
            1,
            ['sk-normalization'],
            'Correctness first. Storage savings are incidental.',
          ),
          mcq(
            'An INNER JOIN between customers and orders omits which rows?',
            [
              'None',
              'Customers with no orders, and orders with no matching customer',
              'Only duplicate rows',
              'Rows containing NULL in any column',
            ],
            1,
            ['sk-joins'],
            'Only matched pairs survive an inner join.',
          ),
          trueFalse(
            '`WHERE price = NULL` matches rows whose price is NULL.',
            false,
            ['sk-sql-queries'],
            'Comparison with NULL yields unknown. Use `IS NULL`.',
          ),
        ],
      },
    },
    // -----------------------------------------------------------------------
    {
      id: 'unit-db-2',
      title: 'Making Queries Fast',
      description: 'Indexes, plans, and picking the right kind of store.',
      lessons: [
        lesson({
          id: 'lesson-indexes',
          title: 'Indexes and Query Plans',
          summary: 'A B-tree on the side, and the plan that decides whether to use it.',
          level: 'intermediate',
          domain: 'databases',
          steps: [
            concept(
              'What an index actually is',
              'An index is a separate sorted structure — nearly always a **B-tree** — mapping column values to row locations. Looking up a value goes from O(n) scanning to O(log n) descending, which at a million rows is roughly 1,000,000 comparisons down to 20.\n\nIt is not free, and the costs are the part people skip:\n\n- **Writes get slower.** Every insert, update, and delete must maintain every index on the table. Ten indexes means ten structures to update per write.\n- **Storage grows.** An index on a wide column can approach the size of the table.\n- **A useless index is pure cost.** It is maintained on every write and never read.\n\nIt also has to be usable. An index on `(last_name, first_name)` is a sorted phone book: it serves a query on `last_name`, and on both together, but **not** a query on `first_name` alone — you cannot find "everyone called James" in a phone book sorted by surname. Leftmost prefix, always.\n\nAnd applying a function to the column defeats it entirely. `WHERE YEAR(created_at) = 2024` cannot use an index on `created_at`, because the index stores timestamps, not years. Rewrite it as a range — `created_at >= \'2024-01-01\' AND created_at < \'2025-01-01\'` — and the index works.',
              {
                keyTerms: [
                  { term: 'B-tree', definition: 'A balanced, high-fan-out tree giving O(log n) lookups on sorted keys.' },
                  { term: 'Leftmost prefix', definition: 'A composite index serves queries on a leading subset of its columns.' },
                ],
              },
            ),
            interactive(
              'Read a query plan',
              'query-plan',
              'Toggle indexes on and off and watch the plan change between a sequential scan, an index scan, and a nested loop. The estimated row counts matter as much as the node types — a plan goes wrong when the estimate is wrong.',
            ),
            mcq(
              'An index exists on (last_name, first_name). Which query can use it?',
              [
                'WHERE first_name = \'Ada\'',
                'WHERE last_name = \'Lovelace\'',
                'WHERE UPPER(last_name) = \'LOVELACE\'',
                'WHERE first_name = \'Ada\' AND email LIKE \'%@x.com\'',
              ],
              1,
              ['sk-db-indexes'],
              'Leftmost prefix. A surname query works; a forename-only query does not, and wrapping the column in a function disqualifies it.',
            ),
            mcq(
              'Why can adding ten indexes to a table make the application slower overall?',
              [
                'Indexes confuse the planner',
                'Every write must update all ten index structures',
                'Indexes are stored in RAM',
                'Reads get slower with more indexes',
              ],
              1,
              ['sk-db-indexes'],
              'Indexes trade write throughput for read speed. Ten of them is ten times the write amplification.',
            ),
            trueFalse(
              '`WHERE YEAR(created_at) = 2024` can use a plain index on created_at.',
              false,
              ['sk-db-indexes'],
              'The function is applied to the column, so the stored keys do not match what is being compared. Rewrite as a half-open range.',
            ),
            concept(
              'Reading the plan',
              'Every database will show you its plan — `EXPLAIN` in PostgreSQL and MySQL, `EXPLAIN QUERY PLAN` in SQLite. Prefix the query and read the tree from the innermost node outward.\n\nThe node types you need:\n\n| Node | Meaning |\n|---|---|\n| Seq Scan | Reading every row. Fine on small tables, alarming on large ones |\n| Index Scan | Descending the B-tree, then fetching the rows |\n| Index Only Scan | Everything needed was in the index; the table was not touched |\n| Nested Loop | For each outer row, look up the inner side |\n| Hash Join | Build a hash of the smaller side, probe once per outer row |\n\nThe number that matters most is not the node type, it is the gap between **estimated** and **actual** rows. `EXPLAIN ANALYZE` shows both. When the planner expects 10 rows and gets 100,000, it chose a nested loop that is now running 100,000 lookups — and the fix is usually stale statistics (`ANALYZE`), not a different index.\n\nThe discipline is the same as in the systems track: measure first. "Add an index" is a guess; the plan is evidence.',
              {
                keyTerms: [
                  { term: 'EXPLAIN ANALYZE', definition: 'Runs the query and reports the real plan with actual row counts and timings.' },
                ],
              },
            ),
            mcq(
              'EXPLAIN ANALYZE shows a nested loop where the planner estimated 10 rows but 90,000 came back. What is the most likely fix?',
              [
                'Add an index on every column',
                'Update the table statistics so the planner estimates correctly and picks a hash join',
                'Rewrite the query as a subquery',
                'Increase work_mem',
              ],
              1,
              ['sk-query-plans'],
              'The plan was reasonable for the estimate it had. Fix the estimate and the plan fixes itself.',
            ),
            order(
              'Order these access strategies from cheapest to most expensive for fetching one row from a large table.',
              ['Index only scan', 'Index scan with a table fetch', 'Sequential scan of the whole table'],
              ['sk-query-plans'],
              'Covering index, then index plus heap fetch, then reading everything.',
            ),
          ],
        }),
        lesson({
          id: 'lesson-oltp-olap',
          title: 'Transactional, Analytical, and Non-Relational',
          summary: 'Three shapes of workload, three shapes of store.',
          level: 'intermediate',
          domain: 'databases',
          steps: [
            concept(
              'Rows for transactions, columns for analytics',
              'Two workloads pull the same technology in opposite directions.\n\n**OLTP** — online transaction processing — is your application database. Many small operations, each touching a few rows, all columns of those rows. "Fetch order 4471." Data is stored **row-wise**, so one row is one contiguous read.\n\n**OLAP** — online analytical processing — is your warehouse. Few enormous queries, each scanning millions of rows but only three or four columns. "Average order value by month for two years." Data is stored **column-wise**, so a query touching 3 of 50 columns reads 6% of the bytes instead of 100%.\n\nColumnar storage also compresses far better, because a single column is a run of similar values. Ten-to-one is ordinary.\n\nThis is why your training data does not live in Postgres. Feature extraction is an OLAP query — scan everything, project a few columns — and a row store is the wrong shape for it by an order of magnitude. It is also why Parquet is columnar, and why the standard architecture is an OLTP database for the app plus a periodic export into a columnar store for analytics and training.',
              {
                keyTerms: [
                  { term: 'OLTP', definition: 'Many small row-level operations; row-oriented storage.' },
                  { term: 'OLAP', definition: 'Few large scans over selected columns; column-oriented storage.' },
                ],
              },
            ),
            categorize(
              'Sort each workload.',
              ['OLTP', 'OLAP'],
              [
                { item: 'Fetch a user profile by id', category: 'OLTP' },
                { item: 'Insert a new order', category: 'OLTP' },
                { item: 'Average session length by country, last 18 months', category: 'OLAP' },
                { item: 'Extract 6 feature columns from 400M events', category: 'OLAP' },
              ],
              ['sk-oltp-olap'],
              'Narrow and frequent versus wide and rare. The access pattern decides the storage layout.',
            ),
            mcq(
              'Why is columnar storage so much faster for a query selecting 3 of 60 columns?',
              [
                'Columns are indexed automatically',
                'Only the 3 requested columns are read from disk, instead of every byte of every row',
                'Columnar stores use more RAM',
                'It parallelises across cores',
              ],
              1,
              ['sk-oltp-olap'],
              'A twentyfold reduction in bytes read, before compression is even considered.',
            ),
            concept(
              'When a non-relational store wins',
              '"NoSQL" names a family, not a technology, and each member drops something specific to buy something specific.\n\n**Key-value** (Redis, DynamoDB): a hash map at scale. Microsecond lookups by key, trivially shardable. You give up querying by anything except the key.\n\n**Document** (MongoDB): JSON documents with flexible schemas. Good when the shape genuinely varies per record. You give up the schema enforcing consistency for you — the constraints move into application code, where they are easier to forget.\n\n**Wide-column** (Cassandra): enormous write throughput, tunable consistency. You design the table per query and give up ad-hoc querying entirely.\n\n**Graph** (Neo4j): relationships are first-class, so deep traversals stay cheap where SQL would need recursive joins.\n\nThe honest default is still relational. Postgres handles JSON columns, full-text search, and vector similarity, and scales further than most teams will ever reach. Choose a non-relational store when you can name the specific relational property you are giving up and what you are buying with it — usually horizontal write scale or schema flexibility. "It is faster" is not a reason; it is faster at one thing and slower at several others.',
              {
                keyTerms: [
                  { term: 'Key-value store', definition: 'Lookup by key only, in exchange for speed and easy sharding.' },
                  { term: 'Document store', definition: 'Flexible per-record structure, with consistency moved into application code.' },
                ],
              },
            ),
            match(
              'Match each store to the thing it is genuinely good at.',
              [
                { left: 'Redis', right: 'Microsecond lookups by a known key' },
                { left: 'Cassandra', right: 'Very high write throughput across many nodes' },
                { left: 'Neo4j', right: 'Deep traversals over relationships' },
                { left: 'PostgreSQL', right: 'Ad-hoc queries with enforced constraints' },
              ],
              ['sk-nosql'],
              'Each buys its strength by giving something up. Know which thing before you choose.',
            ),
            mcq(
              'What do you give up by moving from a relational schema to a schemaless document store?',
              [
                'Nothing, documents are strictly better',
                'Database-enforced structure and constraints, which now have to be maintained in application code',
                'The ability to store nested data',
                'Horizontal scalability',
              ],
              1,
              ['sk-nosql'],
              'Schema flexibility is real, and so is the cost: every writer must now remember rules the database used to enforce.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-db-2',
        title: 'Performance Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'What is the main cost of adding an index?',
            ['Slower reads', 'Slower writes and extra storage', 'Lost constraints', 'Lower durability'],
            1,
            ['sk-db-indexes'],
            'Every write maintains every index.',
          ),
          mcq(
            'In EXPLAIN ANALYZE, which discrepancy most often explains a badly chosen plan?',
            [
              'Node type differing from expectation',
              'A large gap between estimated and actual row counts',
              'The total width of the output rows',
              'The number of columns selected',
            ],
            1,
            ['sk-query-plans'],
            'Bad estimates produce bad plans. Refresh the statistics before rewriting the query.',
          ),
          trueFalse(
            'Columnar storage is the better layout for fetching one complete row by primary key.',
            false,
            ['sk-oltp-olap'],
            'That is the row store’s case — one contiguous read. Columnar wins on wide scans of few columns.',
          ),
        ],
      },
    },
    // -----------------------------------------------------------------------
    {
      id: 'unit-db-3',
      title: 'Correctness at Scale',
      description: 'What a transaction promises, and what survives going distributed.',
      lessons: [
        lesson({
          id: 'lesson-transactions',
          title: 'Transactions and Isolation',
          summary: 'ACID, and the anomalies each isolation level still permits.',
          level: 'intermediate',
          domain: 'databases',
          steps: [
            concept(
              'ACID, one letter at a time',
              'A transaction groups operations so they succeed or fail together. The classic example is a transfer: debit one account, credit another. Halfway is not an acceptable state.\n\n**Atomicity** — all or nothing. A crash between the two statements rolls both back.\n\n**Consistency** — constraints hold at the boundaries. A transaction cannot commit a state that violates a foreign key or a check.\n\n**Isolation** — concurrent transactions do not see each other’s partial work. This is the letter with dials on it, and the next section is about them.\n\n**Durability** — once commit returns, the data survives a crash. This is the `fsync` from the operating systems track, which is why commit latency has a physical floor.\n\nWhat trips people is that ACID is a promise about *the database*, not about your system. If your transaction commits and then your code calls a payment API which fails, the database is perfectly consistent and your business state is not. Transactions do not span systems, which is the entire reason idempotency keys and outbox tables exist.',
              {
                figure: 'acid-transaction',
                keyTerms: [
                  { term: 'Atomicity', definition: 'The transaction applies completely or not at all.' },
                  { term: 'Durability', definition: 'A committed transaction survives a crash, which requires a real disk flush.' },
                ],
              },
            ),
            match(
              'Match each ACID letter to its guarantee.',
              [
                { left: 'Atomicity', right: 'All operations apply, or none do' },
                { left: 'Consistency', right: 'Constraints hold at every transaction boundary' },
                { left: 'Isolation', right: 'Concurrent transactions do not see partial work' },
                { left: 'Durability', right: 'A committed write survives a crash' },
              ],
              ['sk-transactions-acid'],
              'Four separate promises, often blurred into one. Isolation is the only one with a dial.',
            ),
            mcq(
              'Your transaction commits, then an external payment call fails. What has the database guaranteed?',
              [
                'It will roll back the transaction automatically',
                'Nothing about the payment — ACID covers the database only, so you need an idempotency or outbox pattern',
                'The payment will be retried',
                'Consistency is violated',
              ],
              1,
              ['sk-transactions-acid'],
              'Transactions do not cross system boundaries. This gap is where most real-world "we charged them twice" bugs live.',
            ),
            concept(
              'Isolation levels and what each still allows',
              'Perfect isolation — every transaction behaving as though it ran alone — is expensive. So databases offer levels, and each permits specific anomalies:\n\n| Level | Still possible |\n|---|---|\n| Read Uncommitted | Dirty reads: seeing data that is later rolled back |\n| Read Committed | Non-repeatable reads: the same row read twice differs |\n| Repeatable Read | Phantoms: the same *query* returns new rows |\n| Serializable | Nothing; as if transactions ran one at a time |\n\nMost databases default to Read Committed, and most developers never notice, because the anomalies need concurrency and timing to appear. They appear under load, in production, once.\n\nThe canonical bug: read a balance, check it is sufficient, write the new balance. Two concurrent transfers both read 100, both approve, both write 50, and 100 has been spent twice. At Read Committed this is entirely legal. The fixes are `SELECT ... FOR UPDATE` to lock the row, an atomic `UPDATE ... SET balance = balance - 50 WHERE balance >= 50`, or Serializable isolation and a retry loop.\n\nSerializable is not free — it detects conflicts and aborts transactions, so your code must be prepared to retry. That retry loop is the price of not thinking about anomalies.',
              {
                keyTerms: [
                  { term: 'Dirty read', definition: 'Reading uncommitted data that may later be rolled back.' },
                  { term: 'Phantom read', definition: 'A repeated query returning rows that were not there before.' },
                ],
              },
            ),
            order(
              'Order the isolation levels from weakest to strongest.',
              ['Read Uncommitted', 'Read Committed', 'Repeatable Read', 'Serializable'],
              ['sk-isolation-levels'],
              'Each level forbids one more anomaly and costs a little more concurrency.',
            ),
            mcq(
              'Two concurrent transfers each read a balance of 100, each approve a withdrawal of 50, and both write 50. What happened?',
              [
                'A dirty read',
                'A lost update caused by read-check-write without a lock or atomic update',
                'A phantom read',
                'A deadlock',
              ],
              1,
              ['sk-isolation-levels'],
              'Read Committed permits this. Fix with SELECT FOR UPDATE, an atomic conditional UPDATE, or Serializable plus retries.',
            ),
            multi(
              'Which correctly fix the lost-update problem above?',
              [
                'SELECT ... FOR UPDATE on the row before checking',
                'UPDATE accounts SET balance = balance - 50 WHERE id = ? AND balance >= 50',
                'Serializable isolation with a retry on conflict',
                'Reading the balance twice to confirm',
              ],
              [0, 1, 2],
              ['sk-isolation-levels'],
              'Lock it, make the check-and-write one atomic statement, or let the database detect the conflict. Reading twice only narrows the window.',
            ),
          ],
        }),
        lesson({
          id: 'lesson-replication',
          title: 'Replication and Sharding',
          summary: 'Copies for safety, splits for size, and the consistency you pay with.',
          level: 'expert',
          domain: 'databases',
          steps: [
            concept(
              'Two different problems, two different answers',
              'People say "scale the database" as if it were one thing. It is two, and they have different solutions.\n\n**Replication** — keep full copies on several machines. It solves availability (a node dies, another serves), read throughput (spread reads across replicas), and locality (a replica near your users). It does **not** help with write throughput, because every replica must apply every write.\n\n**Sharding** — split the data by key across machines, each holding a disjoint slice. It solves write throughput and dataset size, which replication cannot. It costs you: cross-shard queries need a scatter-gather, cross-shard transactions need two-phase commit or a redesign, and a bad shard key creates a hot shard that becomes the bottleneck you were escaping.\n\nReplication has its own sharp edge. Asynchronous replication means a replica lags — often milliseconds, occasionally seconds. Write then immediately read from a replica and you may not see your own write. Every team meets this bug, usually as "the profile page shows the old name right after saving". The standard fixes are read-your-writes routing (send a user’s reads to the primary briefly after they write) or sticky sessions.\n\nSynchronous replication removes the lag and adds a network round trip to every commit. As always, you are choosing which cost to pay, not avoiding cost.',
              {
                keyTerms: [
                  { term: 'Replication lag', definition: 'The delay before a write appears on an asynchronous replica.' },
                  { term: 'Shard key', definition: 'The column deciding which shard a row lives on; a poor choice creates hot shards.' },
                ],
              },
            ),
            mcq(
              'Your write throughput is saturated. Does adding read replicas help?',
              [
                'Yes, it spreads the load',
                'No — every replica must apply every write, so writes are unchanged; sharding is the lever for write throughput',
                'Yes, if the replicas are synchronous',
                'Only for large rows',
              ],
              1,
              ['sk-sharding-replication'],
              'Replication scales reads and availability. Only splitting the data scales writes.',
            ),
            mcq(
              'A user updates their name and immediately sees the old one. What is the most likely cause?',
              [
                'A caching bug in the browser',
                'The read went to an asynchronous replica that has not yet applied the write',
                'The transaction did not commit',
                'The index is stale',
              ],
              1,
              ['sk-sharding-replication'],
              'Replication lag. Route a user’s reads to the primary for a short window after they write.',
            ),
            trueFalse(
              'A shard key with low cardinality, such as country, is usually a good choice.',
              false,
              ['sk-sharding-replication'],
              'It concentrates a disproportionate share of traffic on one shard. You want a key that spreads load evenly and keeps related rows together.',
            ),
            shortAnswer(
              'A social app has a single Postgres instance that is at 95% CPU on writes and 60% on reads, with 4 TB of data. What would you do, and in what order?',
              ['replica', 'read', 'shard', 'write', 'index'],
              'First confirm where the write cost is going — check for unused indexes and unnecessary write amplification, since removing those is far cheaper than re-architecting. Then add read replicas to move the 60% read load off the primary, which buys headroom immediately. Sharding is the real answer for saturated writes and a 4 TB dataset, but it is the largest change, so it comes last and needs a shard key chosen to spread load evenly while keeping related rows co-located.',
              ['sk-sharding-replication'],
              'Cheapest interventions first, then replicas for reads, then sharding for writes. Sharding last because it is the one you cannot easily undo.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-db-3',
        title: 'Transactions and Scale Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'Which ACID property requires an actual disk flush and therefore sets a floor on commit latency?',
            ['Atomicity', 'Consistency', 'Isolation', 'Durability'],
            3,
            ['sk-transactions-acid'],
            'Durability means it survives power loss, which means fsync.',
          ),
          mcq(
            'At Read Committed, which anomaly is still possible?',
            ['Dirty reads', 'Non-repeatable reads', 'Nothing', 'Only phantoms'],
            1,
            ['sk-isolation-levels'],
            'Dirty reads are excluded; the same row read twice within one transaction can still differ.',
          ),
          trueFalse(
            'Sharding is the right tool when write throughput, not read throughput, is the bottleneck.',
            true,
            ['sk-sharding-replication'],
            'Replicas multiply reads; only splitting the data multiplies writes.',
          ),
        ],
      },
    },
  ],
};
