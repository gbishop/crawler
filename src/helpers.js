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
  if (array.filter(a => a.exit[2].isoObjects.length > 0).length == 0) {
    let a = [];
    for (let i = array.length - 1; i > 0; i--) {
      a.push(array[i]);
    }
    console.log(a.map(a=> a.exit[2].xy));
    return a;
  } 
  return array.sort((a,b) => b.exit[2].isoObjects.length - a.exit[2].isoObjects.length);
}
