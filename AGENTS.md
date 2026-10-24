<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Sales and inventory forms share browser-safe quantity validation in `src/lib/stock-validation.ts`; database RPCs remain authoritative to protect stock under concurrent writes.
- Invalidate the query cache after inventory or sales writes so closing, reports, stock history, and dashboard do not keep stale totals.
