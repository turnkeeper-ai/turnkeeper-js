# First contribution walkthrough

This walkthrough is for a **documentation-only** first contribution. It assumes
you have not changed public contracts, package behavior, or examples beyond
docs.

Stop and ask on the issue before changing public contracts, adding packages,
expanding product behavior, or touching hosted-platform concerns. Those changes
need an accepted feature proposal and are outside this path.

## 1. Choose work

1. Open the [`good first issue`](https://github.com/turnkeeper-ai/turnkeeper-js/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)
   list.
2. Pick an **unassigned** issue whose acceptance criteria are complete.
3. Comment that you intend to work on it before starting, so maintainers and
   other contributors can avoid duplicate work.

Do not wait for a formal assignment. If someone else is already progressing on
the issue, pick another.

## 2. Fork, clone, and branch

Fork `turnkeeper-ai/turnkeeper-js` on GitHub, then:

```bash
git clone https://github.com/<your-github-username>/turnkeeper-js.git
cd turnkeeper-js
git remote add upstream https://github.com/turnkeeper-ai/turnkeeper-js.git
git fetch upstream
git checkout -b docs/<short-topic> upstream/main
```

Use a focused branch name that matches the issue (for example
`docs/glossary` for a glossary change).

## 3. Install and confirm the gate

Use Node.js 22.20 or Node.js 24 and npm 11.

```bash
node --version
npm --version
npm ci
npm run check
```

Every command above already exists in this repository. `npm run check` must
pass on a clean tree before you edit. If it fails, stop and report the exact
command and error on the issue instead of bypassing checks.

## 4. Make a documentation-only change

Edit only the documentation paths named in the issue (usually under `docs/`,
`README.md`, package READMEs, or `examples/*/README.md`).

- Keep fixtures and identifiers synthetic.
- Use placeholders such as `<your-github-username>`, `<api-key>`, and
  `https://example.invalid` — never real usernames, tokens, credentials, or
  local absolute paths.
- Do not regenerate or hand-edit package `dist/` output.
- Do not expand the public surface or invent hosted behavior.

While iterating on docs, there is no focused package test script. Confirm links
and wording, then run the repository gate again:

```bash
npm run check
```

## 5. Commit with DCO sign-off

Configure Git with the name and email you use for GitHub contributions, then
create a signed-off commit:

```bash
git add docs/first-contribution.md   # replace with the paths you changed
git commit -s -m "docs: describe the change"
```

The `-s` flag adds a `Signed-off-by` trailer. That trailer is your Developer
Certificate of Origin certification; it is not a GPG signature. Pull requests
cannot merge until every commit passes the DCO check.

If your latest commit is missing the trailer:

```bash
git commit --amend --no-edit --signoff
```

## 6. Open the pull request

Push your branch to your fork and open a pull request against
`turnkeeper-ai/turnkeeper-js` `main`.

In the pull request body:

- link the issue (for example `Fixes #<issue-number>`)
- state that the change is documentation-only and list public compatibility
  impact as none
- include evidence that `npm run check` passed (command + result summary)
- note anything you could not verify

Keep the pull request scoped to one issue. Avoid unrelated cleanup.

## 7. What maintainers expect

Maintainers target an initial response to review-ready pull requests within
five business days during the alpha period. That is a response target, not a
merge or release SLA. See [CONTRIBUTING.md](../CONTRIBUTING.md) and
[GOVERNANCE.md](../GOVERNANCE.md).

## Related reading

- [CONTRIBUTING.md](../CONTRIBUTING.md) — full contributor contract
- [docs/contributor-architecture.md](contributor-architecture.md) — package map
- [ROADMAP.md](../ROADMAP.md) — public sequencing
- [SUPPORT.md](../SUPPORT.md) — how to get help
