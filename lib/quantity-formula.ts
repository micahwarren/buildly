/** Arithmetic only. Never evaluates model text as JavaScript or accepts units/functions. */
export function quantityFormula(source: string) {
  if (typeof source !== "string" || !source.trim() || source.length > 240)
    throw Error("Invalid quantity calculation");
  source = source.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-");
  if (/\d\s+[\d.]|\.\s+\d/.test(source))
    throw Error("Separate numbers require an operator");
  const compact = source.replace(/\s+/g, "");
  const tokens = compact.match(/\d+(?:\.\d+)?|[()+*/-]/g) || [];
  if (tokens.join("") !== compact || tokens.length > 100)
    throw Error("Invalid quantity calculation");
  let cursor = 0;
  function primary(depth: number): number {
    if (depth > 16) throw Error("Quantity calculation is too deep");
    const token = tokens[cursor++];
    if (token === "+" || token === "-")
      return (token === "-" ? -1 : 1) * primary(depth + 1);
    if (token === "(") {
      const n = expression(depth + 1);
      if (tokens[cursor++] !== ")")
        throw Error("Unclosed quantity calculation");
      return n;
    }
    if (!token || !/^\d+(?:\.\d+)?$/.test(token))
      throw Error("Invalid quantity calculation");
    return Number(token);
  }
  function term(depth: number): number {
    let n = primary(depth);
    while (tokens[cursor] === "*" || tokens[cursor] === "/") {
      const op = tokens[cursor++],
        value = primary(depth);
      n = op === "*" ? n * value : n / value;
    }
    return n;
  }
  function expression(depth: number): number {
    let n = term(depth);
    while (tokens[cursor] === "+" || tokens[cursor] === "-") {
      const op = tokens[cursor++],
        value = term(depth);
      n = op === "+" ? n + value : n - value;
    }
    return n;
  }
  const n = expression(0);
  if (cursor !== tokens.length || !Number.isFinite(n) || n < 0 || n > 1000000)
    throw Error("Quantity calculation is out of range");
  return Math.round(n * 1000000) / 1000000;
}
