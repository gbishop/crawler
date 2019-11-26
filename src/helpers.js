/**
 * Type safe function to get HTMLInputElements
 *
 * @param {string} query - the query string
 * @return {HTMLInputElement}
 */
export function getInput(query) {
  return /** @type {HTMLInputElement} */ (document.querySelector(query));
}

/**
 * Type safe function to get all HTMLInputElements
 *
 * @param {string} query - the query string
 * @returns {HTMLInputElement[]}
 */
export function getInputAll(query) {
  return [
    .../** @type {NodeListOf<HTMLInputElement>} */ (document.querySelectorAll(
      query
    ))
  ];
}

export function sortByDistance(array, x, y) {
    return array.sort(
      (a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y)
    );
}

export function sortByNumberOfObjects(array){
  console.log(array);
  return array.sort((a,b) => b.exit[2].isoObjects.length - a.exit[2].isoObjects.length);
}
