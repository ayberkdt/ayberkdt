# Profile statistics

The profile uses committed SVG cards instead of requesting a third-party stats service every time someone visits. GitHub serves the images directly from this repository.

## Refresh

The [workflow](../.github/workflows/update-profile-stats.yml) runs daily at **06:23 UTC / 09:23 Istanbul time**, on relevant pushes to `main`, or manually through **Actions → Update profile stats → Run workflow**. Scheduled runs can be delayed by GitHub; the card date always reflects the last successful generation, in UTC.

It uses Node.js 24 and the repository's built-in `GITHUB_TOKEN`. No npm dependencies, personal access token, or external hosting account are needed. The token needs `contents: write` to commit the generated files. If branch protection later disallows bot pushes, the workflow will need a pull-request-based publishing step.

GitHub can disable scheduled workflows in public repositories after 60 days without repository activity. If that happens, re-enable the workflow in Actions. See [GitHub's schedule documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

## What the cards measure

- **Public repositories:** all public repositories owned by `ayberkdt`, including forks and the profile repository.
- **Stars earned:** stars on owned public repositories that are not forks, including archived repositories.
- **Followers:** the public follower count returned by GitHub.
- **Source languages:** distinct languages in owned, non-fork, non-archived public repositories, excluding this profile repository and `Jupyter Notebook`.
- **Language share:** summed bytes from GitHub's repository-language API using the same exclusions. The five largest languages are shown individually; remaining languages are grouped as **Other**. This measures repository contents, not time spent, proficiency, or authorship. GitHub's language detection determines how vendored and generated files are classified.

The script paginates the repository list and explicitly filters private and non-owned repositories even when running with a token. It does not estimate all-time commits or expose private contribution counts.

The [snapshot](../assets/stats/snapshot.json) records the public counts, source repository names, exact language byte totals, exclusions, and date. API sources: [user profile](https://docs.github.com/en/rest/users/users#get-a-user), [public repository list](https://docs.github.com/en/rest/repos/repos#list-repositories-for-a-user), and [repository languages](https://docs.github.com/en/rest/repos/repos#list-repository-languages).

## Local maintenance

```sh
node --test scripts/update-profile-stats.test.mjs
node scripts/update-profile-stats.mjs
```

Local generation works with unauthenticated public API access while its rate limit permits. An optional `GITHUB_TOKEN` increases the allowance; never put a token in a tracked file.

Transient network errors, HTTP 429, and server errors are retried up to three attempts. Failed or incomplete API collection exits with an error before touching the existing cards. The workflow commits only the three generated files and only when they change. If a run fails, the last committed snapshot remains visible rather than being replaced by an error image.
