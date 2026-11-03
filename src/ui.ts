export const DISCLAIMER = "Practice seeding - not federation-compliant";
export const escape = (v: unknown) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export const button = (
  label: string,
  action: string,
  cls = "",
  disabled = false,
) =>
  `<button type="button" data-action="${action}" class="${cls}" ${disabled ? "disabled" : ""}>${label}</button>`;
export const badge = (label: string, cls = "") =>
  `<span class="badge ${cls}">${escape(label)}</span>`;
export const disclaimer = () =>
  `<p class="disclaimer" data-disclaimer>${DISCLAIMER}</p>`;
export const empty = (title: string, body: string) =>
  `<div class="empty"><span class="empty-mark" aria-hidden="true">≋</span><h3>${title}</h3><p>${body}</p></div>`;
export const options = (values: (string | number)[], selected: unknown) =>
  values
    .map(
      (v) =>
        `<option value="${escape(v)}" ${v === selected ? "selected" : ""}>${escape(v)}</option>`,
    )
    .join("");
export const field = (
  label: string,
  path: string,
  value: unknown,
  type = "text",
  extra = "",
) =>
  `<label>${label}<input data-meet="${path}" type="${type}" value="${escape(value)}" ${extra}></label>`;
export const selectField = (
  label: string,
  path: string,
  value: unknown,
  values: (string | number)[],
) =>
  `<label>${label}<select data-meet="${path}">${options(values, value)}</select></label>`;
export function assertDisclaimer(root: Element) {
  if (!root.textContent?.includes(DISCLAIMER))
    throw Error("Missing practice-seeding disclaimer");
}
