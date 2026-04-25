# Milestone 1.1: Cryptography — The Foundation of Trust

---

## Why Start Here?

Every blockchain operation — sending tokens, validating blocks, proving ownership —
relies on cryptography. Without understanding these primitives, the rest of
blockchain is just magic words.

There are **3 cryptographic tools** that make blockchain possible:
1. **Hash Functions** — fingerprinting data
2. **Digital Signatures** — proving identity
3. **Merkle Trees** — efficiently verifying large datasets

---

## 1. Hash Functions

### What is a Hash Function?

A hash function is a mathematical one-way function that takes **any input**
and produces a **fixed-size output** (called a hash, digest, or fingerprint).

```
Input (any size)  →  [ Hash Function ]  →  Output (fixed size)

"hello"           →  [ SHA-256 ]        →  2cf24dba5fb0a30e26e83b2ac5b9e29e...
"Hello"           →  [ SHA-256 ]        →  185f8db32271d2ebaef6e8bb6d03d8b5...
War and Peace     →  [ SHA-256 ]        →  a single 256-bit number
(500,000 words)
```

### The 5 Properties That Matter

#### Property 1: Deterministic
Same input ALWAYS gives same output. No randomness.
```
SHA-256("cosmos") today     = abc123...
SHA-256("cosmos") tomorrow  = abc123...  (identical, always)
```
**Why it matters:** Nodes on different continents can independently verify
the same data produces the same hash. No coordination needed.

#### Property 2: Fixed Output Length
No matter the input size, output is always the same length.
```
SHA-256("a")                              = 256 bits
SHA-256("entire contents of Wikipedia")   = 256 bits
```
**Why it matters:** Block headers always have the same size. Predictable
storage and comparison.

#### Property 3: Avalanche Effect
Change 1 bit of input → output changes completely (~50% of bits flip).
```
SHA-256("hello")  →  2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c...
SHA-256("hellp")  →  4617d74f22f65a5a1c0f72f8f8b4f2c3a9d5e7f1...
         ^                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
         1 letter          completely different hash
```
**Why it matters:** You cannot "gradually" forge a hash. You can't change
a transaction slightly and get a similar hash. It's all or nothing.

#### Property 4: One-Way (Pre-image Resistance)
Given a hash, you CANNOT compute the original input.
```
Given: 2cf24dba5fb0a30e26e83b2ac5b9e29e...
Find:  ????

Answer: Impossible. You'd need to try every possible input.
For 256 bits: 2^256 attempts ≈ 10^77 (more than atoms in the universe)
```
**Why it matters:** Knowing a block's hash tells you nothing about how
to produce fake data with that hash.

#### Property 5: Collision Resistant
Practically impossible to find two different inputs with the same hash.
```
Find x ≠ y where SHA-256(x) == SHA-256(y)

Probability per attempt: 1 / 2^256
Even with all computers on Earth running for billions of years: won't find one.
```
**Why it matters:** Each block/transaction has a unique fingerprint.
No two different blocks can have the same hash.

### Hash Functions Used in Blockchain

| Hash Function | Output Size | Used By |
|---------------|-------------|---------|
| SHA-256 | 256 bits (32 bytes) | Bitcoin, Cosmos |
| Keccak-256 | 256 bits (32 bytes) | Ethereum |
| BLAKE2 | Configurable | Zcash, Substrate |
| RIPEMD-160 | 160 bits (20 bytes) | Bitcoin addresses |
| SHA-512 | 512 bits (64 bytes) | Ed25519 signatures |

### Where Hashing is Used in Blockchain

```
1. Block Identity
   block_hash = SHA-256(block_header)
   → Every block IS its hash

2. Chain Linking
   block.prev_hash = SHA-256(previous_block)
   → This creates the "chain" in blockchain

3. Transaction ID
   tx_hash = SHA-256(serialized_transaction)
   → "Transaction 0xabc..." is actually its hash

4. Merkle Root
   root = hash(hash(hash(tx1) + hash(tx2)) + hash(hash(tx3) + hash(tx4)))
   → Summarizes all txs in one hash (more on this later)

5. Address Generation
   address = RIPEMD-160(SHA-256(public_key))
   → Your wallet address is derived from hashes

6. Proof of Work
   Find nonce where SHA-256(block + nonce) < target
   → Mining IS hashing
```

---

## 2. Digital Signatures

### The Problem They Solve

Alice wants to send 100 ATOM to Bob. How does the network know:
- It's really Alice who sent this? (not someone impersonating her)
- The message wasn't altered in transit? (nobody changed 100 to 10000)
- Alice can't deny she sent it? (non-repudiation)

Answer: **Digital Signatures**.

### Key Pair Generation

Everything starts with generating a key pair:

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   Random Number (256 bits of entropy)                   │
│         │                                               │
│         ▼                                               │
│   ┌──────────────┐                                      │
│   │ Private Key   │  ← SECRET. Never share. Never lose. │
│   │ (256 bits)    │                                      │
│   └──────┬───────┘                                      │
│          │ mathematical derivation (one-way)            │
│          ▼                                               │
│   ┌──────────────┐                                      │
│   │ Public Key    │  ← Share freely. Your identity.     │
│   │ (point on     │                                      │
│   │  elliptic     │                                      │
│   │  curve)       │                                      │
│   └──────┬───────┘                                      │
│          │ hash + encode                                │
│          ▼                                               │
│   ┌──────────────┐                                      │
│   │ Address       │  ← cosmos1abc..., 0x742d...         │
│   │ (shortened)   │                                      │
│   └──────────────┘                                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Key insight:** Private → Public → Address is one-way at each step.
You CANNOT go backwards. Knowing an address doesn't reveal the public key.
Knowing the public key doesn't reveal the private key.

### How Signing Works

```
Step 1: Alice creates a message
  msg = { from: "cosmos1alice", to: "cosmos1bob", amount: 100 }

Step 2: Alice signs with her private key
  signature = SIGN(private_key, hash(msg))
  → signature is 64 bytes (two 32-byte numbers: r, s)

Step 3: Alice broadcasts to the network
  broadcast({ msg, signature, public_key })

Step 4: Any node verifies
  valid = VERIFY(public_key, hash(msg), signature)
  → true or false

  If true:
    ✓ Message came from the holder of this private key
    ✓ Message was not altered (hash would change → verification fails)
    ✓ Signature cannot be reused for a different message
```

### Why Can't You Forge a Signature?

The math is based on the **Elliptic Curve Discrete Logarithm Problem (ECDLP)**.

```
Public Key = private_key × G    (where G is a known generator point)

To forge: you'd need to find private_key given Public Key and G.
This requires solving discrete logarithm on an elliptic curve.

Best known attack: ~2^128 operations for a 256-bit curve
= 340,282,366,920,938,463,463,374,607,431,768,211,456 operations
= computationally impossible with any existing or foreseeable technology
```

### Signature Algorithms Used in Blockchain

| Algorithm | Curve | Used By | Key Property |
|-----------|-------|---------|--------------|
| ECDSA | secp256k1 | Bitcoin, Ethereum, Cosmos | Most widely adopted |
| Ed25519 | Curve25519 | Solana, Cosmos (optional) | Faster, constant-time (safer) |
| Schnorr | secp256k1 | Bitcoin (Taproot) | Signature aggregation |
| BLS | BLS12-381 | Ethereum 2.0 | Many sigs → one sig |

### ECDSA vs Ed25519 — Why It Matters

```
ECDSA (secp256k1):
  ✓ Battle-tested (Bitcoin since 2009)
  ✓ Widely supported
  ✗ Trickier to implement safely (nonce reuse = key leak!)
  ✗ Signature malleability (same valid sig can have two forms)

Ed25519 (Curve25519):
  ✓ Faster to verify
  ✓ Constant-time (resistant to timing attacks)
  ✓ Deterministic nonces (no nonce reuse vulnerability)
  ✓ Smaller signatures
  ✗ Newer, less ecosystem support (but growing fast)

Solana chose Ed25519 → speed + safety
Cosmos supports both → flexibility
```

### The Nonce Reuse Disaster (Real-World Example)

In 2010, a PlayStation 3 signing key was leaked because Sony reused the
same random nonce `k` in two ECDSA signatures.

```
Signature 1: (r1, s1) using nonce k
Signature 2: (r2, s2) using SAME nonce k

Because r = (k × G).x, both signatures had the same r value.
From two equations with two unknowns, the private key was solved
with basic algebra.

Lesson: ECDSA security depends entirely on unique random nonces.
Ed25519 avoids this by deriving nonces deterministically from the message.
```

---

### Deep Dive: Elliptic Curves and How Signing Really Works

Everything above gave you the "what." This section gives you the "how" —
the actual math, step by step, with every term explained.

#### The Vocabulary

```
Private Key (d):     A secret random NUMBER. Just a big number. Nothing fancy.
                     Only you know it. Like a password but it's a number.

Public Key (P):      A POINT on the curve. Derived from private key.
                     Everyone can see it. Like your username.

Generator Point (G): A POINT on the curve that everyone in the world agrees on.
                     It's hardcoded in the standard. Like a universal starting point.

Hash (h):            A fingerprint of your message. Fixed size number.
                     SHA-256("hello") always gives the same 256-bit number.

Nonce (k):           A random number used ONCE to hide your private key.
                     "Nonce" literally means "number used once".

Signature (r, s):    Two numbers that prove you signed something.
                     r = comes from the nonce
                     s = combines everything together

mod (modular):       Clock arithmetic. Numbers wrap around.
                     17 mod 12 = 5 (like a clock wrapping past 12)
                     All math here wraps around a huge prime number p.

n (order):           The total number of points on the curve.
                     All arithmetic with private keys wraps around n.
                     For secp256k1: n ≈ 2^256 (a 78-digit number)

× (multiply):        When we say d × G, we mean:
                     Add G to itself d times using point addition.
                     NOT regular number multiplication.

Inverse (k⁻¹):      The number that when multiplied by k gives 1.
                     k × k⁻¹ = 1 (mod n)
                     Like: 5 × ? = 1 mod 7 → ? = 3 because 5×3=15, 15 mod 7 = 1
                     We use this instead of "division" because
                     there's no division in modular math.
```

#### What is an Elliptic Curve?

An elliptic curve is a specific type of equation:

```
y² = x³ + ax + b

For secp256k1 (Bitcoin/Cosmos curve):
y² = x³ + 7
```

Plotted with regular numbers it looks like a smooth symmetric curve.
But in actual cryptography, we use modular arithmetic (mod a huge prime),
which turns it into scattered dots with no visible pattern.
The math rules (point addition) work the same on both.

#### Point Addition — The Core Operation

Pick two points P and Q on the curve:

```
Step 1:  Draw a straight line through P and Q.

Step 2:  The line hits the curve at a third point R'.
         Why? A line and a cubic curve always intersect at 3 points.
         We know 2 (P and Q), so the 3rd (R') is guaranteed.

Step 3:  Flip R' across the x-axis.
         R' = (x, y)  →  R = (x, -y)
         Just negate the y-coordinate.

         R = P + Q     ← this is "point addition"
```

Point doubling (adding a point to itself):

```
P + P = 2P

Same rule, but draw the tangent line at P instead of
a line through two different points. The tangent hits
the curve at one other point, flip it, done.
```

Repeated addition gives multiplication:

```
1 × G = G
2 × G = G + G           (point doubling)
3 × G = 2G + G          (point addition)
4 × G = 2G + 2G         (double the double)
...
d × G = Public_Key      (after d additions)
```

#### The Trapdoor — Why This is Secure

```
Forward (EASY):
  Given d=42 and G, compute 42 × G  →  milliseconds

Reverse (IMPOSSIBLE):
  Given the result point and G, find 42  →  billions of years

There is NO shortcut. Each point addition lands at a seemingly
random location. No pattern, no formula to reverse it.
This is the Elliptic Curve Discrete Logarithm Problem (ECDLP).
```

#### Setup (Done Once)

**Step 1 — Pick a Private Key:**

```
d = random number between 1 and n-1

This is your SECRET. Never share it.
```

**Step 2 — Compute Public Key:**

```
Public_Key = d × G

Meaning: Take the generator point G, do point addition d times.
Result is a POINT (x, y) on the curve. Share it with the world.
```

**Step 3 — Derive Address:**

```
address = RIPEMD-160(SHA-256(Public_Key))

Hash the public key twice to shorten it:
  64 bytes → 32 bytes → 20 bytes → encode as "cosmos1abc..."
```

```
Summary:

  random number → private key (d)        SECRET
                     ↓ multiply by G
                  public key (Px, Py)     PUBLIC
                     ↓ hash twice
                  address                  PUBLIC

  Each step is ONE WAY. Cannot reverse.
```

#### Signing a Message — Complete Math

Alice wants to sign: "send 100 ATOM to Bob"

**Step 1 — Hash the message:**

```
h = SHA-256("send 100 ATOM to Bob")   → a 256-bit number

Why hash? The message could be any size. The math needs a fixed-size number.
```

**Step 2 — Pick a random nonce:**

```
k = random number between 1 and n-1 (used ONCE, then thrown away)

Why? To HIDE the private key d inside the signature.
Without k, the equation would expose d directly.
```

**Step 3 — Compute r (first half of signature):**

```
R = k × G           ← point addition, k times
r = R.x              ← just take the x-coordinate

r is the FIRST HALF of the signature.
```

**Step 4 — Compute s (second half of signature):**

```
s = k⁻¹ × (h + r × d)  mod n

Breaking every piece:

  r × d     →  signature × private key
               BINDS the signature to your identity

  h + r×d   →  add the message hash
               BINDS the signature to this specific message

  k⁻¹ × ... →  multiply by inverse of nonce
               HIDES the private key

  mod n     →  clock arithmetic, keeps numbers in valid range
```

**Step 5 — Broadcast:**

```
Alice sends:  message, signature (r, s), public_key
NOT sent:     d (private key), k (nonce) — these stay secret
```

**Worked example with small numbers (d=7, k=3, h=5, n=13):**

```
  R = 3 × G         → some point, suppose R.x = 11
  r = 11

  r × d = 11 × 7 = 77
  h + r×d = 5 + 77 = 82
  k⁻¹ = 3⁻¹ mod 13 = 9   (because 3 × 9 = 27, 27 mod 13 = 1 ✓)
  s = 9 × 82 mod 13 = 738 mod 13 = 10

  Signature = (r=11, s=10)
```

#### Verification — Complete Math

Anyone receives: message, (r, s), Public_Key

**Step 1 — Hash the message (same as signer did):**

```
h = SHA-256("send 100 ATOM to Bob") = 5   (deterministic, same number)
```

**Step 2 — Compute s⁻¹:**

```
s⁻¹ = inverse of s mod n

s=10, n=13:  10 × 4 = 40, 40 mod 13 = 1  →  s⁻¹ = 4
```

**Step 3 — Compute u1 and u2:**

```
u1 = h × s⁻¹ mod n  =  5 × 4 mod 13  =  20 mod 13  =  7
u2 = r × s⁻¹ mod n  =  11 × 4 mod 13  =  44 mod 13  =  5

These are weights: one for the message (u1), one for the signature (u2).
```

**Step 4 — Compute the verification point:**

```
V = u1 × G  +  u2 × Public_Key

  u1 × G          → point multiplication (G added to itself u1 times)
  u2 × Public_Key → point multiplication (PubKey added to itself u2 times)
  then POINT ADDITION of the two results

This is where all the point addition is used.
```

**Step 5 — Check:**

```
Does V.x == r?

  YES → valid ✓  (Alice really signed this)
  NO  → fake ✗   (forged or message was altered)
```

#### Why Does Verification Work? (The Proof)

```
V = u1 × G + u2 × Public_Key

Substitute:
  u1 = h × s⁻¹
  u2 = r × s⁻¹
  Public_Key = d × G

V = (h × s⁻¹) × G  +  (r × s⁻¹) × (d × G)
  = s⁻¹ × (h + r × d) × G

Alice computed:
  s = k⁻¹ × (h + r × d)

So:
  s⁻¹ = k / (h + r × d)

Substitute:
  V = [k / (h + r × d)] × (h + r × d) × G

  (h + r × d) cancels out:
  V = k × G = R

  V.x = R.x = r  ✓

The math circles back perfectly. The verifier arrives at the same
point R that Alice created, WITHOUT ever knowing k or d.
This only works if the signer knew the real private key.

If anyone changes the message → h changes → cancellation fails → ✗
If anyone fakes the signature → d is wrong → cancellation fails → ✗
```

#### Why the Nonce k? Why Not Use d Directly?

```
If you used d directly:
  s = (h + r × d) / d

  Anyone sees s, h, r → solve for d → PRIVATE KEY LEAKED

With nonce k:
  s = k⁻¹ × (h + r × d)

  Attacker sees s, h, r but TWO unknowns: d AND k
  One equation, two unknowns → cannot solve

k is a mask that hides d. New k for every signature.
Reuse k twice → two equations, two unknowns → solvable → key leaked.
(This is the Sony PS3 disaster.)
```

#### Complete Visual Flow

```
═══════════════ ALICE (SIGNER) ═══════════════

  d (secret)    k (random)    message
      │              │            │
      │              │            ▼
      │              │      h = SHA-256(msg)
      │              │            │
      │              ▼            │
      │         R = k × G        │
      │         r = R.x ─────────┤
      │              │            │
      ▼              ▼            ▼
      └──────► s = k⁻¹(h + r×d) mod n
                     │
                     ▼
              signature (r, s)
                     │
                     ▼
            ┌─── BROADCAST ───┐
            │  msg, (r,s), P  │
            └────────┬────────┘
                     │
═══════════ ANY VERIFIER (NODE) ═══════════

                     │
            msg, (r,s), Public_Key
              │    │  │      │
              ▼    │  │      │
        h = SHA-256│  │      │
              │    │  │      │
              ▼    ▼  ▼      │
          u1 = h×s⁻¹         │
          u2 = r×s⁻¹         │
              │    │          │
              ▼    ▼          ▼
          V = u1×G  +  u2×Public_Key
                     │
                     ▼
               V.x == r ?
              ╱          ╲
           YES            NO
            ✓              ✗
         valid           fake
```

---

## 3. Merkle Trees

### The Problem They Solve

A block contains 1000 transactions. You want to prove that YOUR transaction
is in the block. Do you need to download all 1000 transactions?

**Without Merkle tree:** Yes. Download everything, hash it, compare.
**With Merkle tree:** No. You only need ~10 hashes (log₂ 1000 ≈ 10).

### How a Merkle Tree Works

Build a binary tree of hashes, bottom-up:

```
                        ┌──────────┐
                        │Root Hash │  ← This goes in the block header
                        │  H(AB+CD)│
                        └────┬─────┘
                   ┌─────────┴─────────┐
              ┌────┴─────┐        ┌────┴─────┐
              │  H(A+B)  │        │  H(C+D)  │
              └────┬─────┘        └────┬─────┘
            ┌──────┴──────┐     ┌──────┴──────┐
        ┌───┴───┐    ┌───┴───┐ ┌───┴───┐  ┌───┴───┐
        │ H(Tx1)│    │ H(Tx2)│ │ H(Tx3)│  │ H(Tx4)│
        └───┬───┘    └───┬───┘ └───┬───┘  └───┬───┘
            │            │         │           │
           Tx1          Tx2       Tx3         Tx4

Where:
  H(Tx1)  = SHA-256(Tx1)
  H(A+B)  = SHA-256( H(Tx1) + H(Tx2) )    ← concatenate, then hash
  Root     = SHA-256( H(A+B) + H(C+D) )
```

### Merkle Proof (How Light Clients Verify)

Question: "Is Tx3 included in this block?"

```
I already have: Root Hash (from block header)
I am given:     Tx3, H(Tx4), H(A+B)     ← this is the "proof"

Verification:
  1. Compute H(Tx3) = SHA-256(Tx3)
  2. Compute H(C+D) = SHA-256( H(Tx3) + H(Tx4) )
  3. Compute Root'  = SHA-256( H(A+B) + H(C+D) )
  4. Check: Root' == Root Hash from block header?
     → Yes → Tx3 is in the block ✓

                        ┌──────────┐
                        │ Root     │  ← I verify this matches
                        │ (known)  │
                        └────┬─────┘
                   ┌─────────┴─────────┐
              ┌────┴─────┐        ┌────┴─────┐
              │  H(A+B)  │        │  H(C+D)  │
              │ (given)  │        │(computed) │
              └──────────┘        └────┬─────┘
                                ┌──────┴──────┐
                            ┌───┴───┐    ┌───┴───┐
                            │ H(Tx3)│    │ H(Tx4)│
                            │(compute│   │(given)│
                            └───┬───┘    └───────┘
                                │
                               Tx3 (mine)
```

**Efficiency:**
| Block Size | Full Download | Merkle Proof |
|------------|--------------|--------------|
| 1,000 txs | 1,000 hashes | 10 hashes |
| 1,000,000 txs | 1,000,000 hashes | 20 hashes |
| 1 billion txs | 1 billion hashes | 30 hashes |

That's the power of logarithmic scaling.

### Variants Used in Real Blockchains

| Variant | Used By | Special Property |
|---------|---------|------------------|
| Binary Merkle Tree | Bitcoin | Simple, tx inclusion proofs |
| Patricia Merkle Trie | Ethereum | Key-value state proofs (account balances) |
| IAVL+ Tree | Cosmos | Ordered, versioned state with proofs |
| Sparse Merkle Tree | Various | Efficient non-existence proofs |

### Cosmos Uses IAVL+ Tree

```
Unlike Bitcoin's simple Merkle tree (just for txs), Cosmos uses IAVL+
for its entire STATE:

  Key: "cosmos1alice/balance/uatom"  →  Value: 1000000
  Key: "cosmos1bob/balance/uatom"    →  Value: 500000

The IAVL+ tree can prove:
  ✓ This key exists and has this value (inclusion proof)
  ✓ This key does NOT exist (non-inclusion proof)
  ✓ What the value was at block height 17000000 (versioned)
```

---

## 4. Putting It All Together — A Transaction's Cryptographic Journey

Let's trace what happens cryptographically when Alice sends 100 ATOM to Bob:

```
Step 1: Key Generation (happened once, when Alice created her wallet)
  ─────────────────────────────────────────────────────────────
  random 256 bits → private_key
  private_key × G → public_key (point on secp256k1)
  RIPEMD160(SHA256(public_key)) → address "cosmos1alice..."

Step 2: Transaction Creation
  ─────────────────────────────────────────────────────────────
  msg = {
    from: "cosmos1alice...",
    to:   "cosmos1bob...",
    amount: [{denom: "uatom", amount: "100000000"}]
  }
  tx_bytes = protobuf_encode(msg)

Step 3: Signing
  ─────────────────────────────────────────────────────────────
  sign_bytes = SHA-256(tx_bytes)
  signature = ECDSA_SIGN(private_key, sign_bytes)
  → (r, s) = 64-byte signature

Step 4: Broadcasting
  ─────────────────────────────────────────────────────────────
  broadcast(tx_bytes + signature + public_key) to network

Step 5: Verification (every node does this independently)
  ─────────────────────────────────────────────────────────────
  a) Recompute: sign_bytes = SHA-256(tx_bytes)
  b) Verify: ECDSA_VERIFY(public_key, sign_bytes, signature) → true
  c) Derive: address = RIPEMD160(SHA256(public_key))
  d) Check: derived address == msg.from? → true
  e) Check: balance[address] >= amount? → true
  → Transaction is valid ✓

Step 6: Block Inclusion
  ─────────────────────────────────────────────────────────────
  Validator collects this tx + others into a block.
  Merkle root = hash tree of all txs → goes in block header.
  Block hash = SHA-256(block_header) → becomes block's identity.
  prev_hash = previous block's hash → chain link.

Step 7: State Update
  ─────────────────────────────────────────────────────────────
  IAVL+ tree updated:
    alice_balance: 1000000000 → 900000000
    bob_balance:   500000000  → 600000000
  New state root → goes in next block header.
```

---

## 5. Key Takeaways

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  Hash Functions  → Data integrity. Fingerprint anything.│
│                    Can't forge, can't reverse.          │
│                                                         │
│  Digital Sigs    → Identity & authorization.            │
│                    Prove you own what you claim.        │
│                    Can't impersonate, can't alter.      │
│                                                         │
│  Merkle Trees    → Efficient verification.              │
│                    Prove membership in huge datasets    │
│                    with tiny proofs.                    │
│                                                         │
│  Together they enable TRUSTLESS systems:                │
│    No bank, no government, no corporation needed.      │
│    Math replaces trust.                                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Quiz

Answer these without scrolling up:

1. What are the 5 properties of a cryptographic hash function?
2. Why does the avalanche effect matter for blockchain security?
3. What is the relationship between private key, public key, and address?
4. Why is nonce reuse in ECDSA catastrophic? What does Ed25519 do differently?
5. How many hashes does a Merkle proof need for a block with 1 million txs?
6. What is the difference between a Merkle tree (Bitcoin) and IAVL+ tree (Cosmos)?
7. At which steps in a transaction's journey is hashing used?

---

## Next

→ **Milestone 1.2: Blockchain Core** — blocks, chains, state machines, genesis, forks
