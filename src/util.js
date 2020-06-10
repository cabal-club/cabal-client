'use strict'

function stableSort (li, valueFunc = v => v) {
  if (li.length === 1) {
    return li
  }
  const midpoint = Math.floor(li.length / 2)
  return merge(li.slice(0, midpoint), li.slice(midpoint), valueFunc)

  return merge(
    stableSort(li.slice(0, midpoint), valueFunc),
    stableSort(li.slice(midpoint), valueFunc),
    valueFunc)
}

function merge (left, right, valueFunc = v => v) {
  if (left.length === 0) {
    return right
  }

  if (right.length === 0) {
    return left
  }
  const res = []
  let lIndex = 0
  let rIndex = 0
  while (lIndex < left.length && rIndex < right.length) {
    const lVal = valueFunc(left[lIndex])
    const rVal = valueFunc(right[rIndex])
    if (lVal <= rVal) {
      res.push(left[lIndex++])
    } else {
      res.push(right[rIndex++])
    }
  }

  if (lIndex === left.length) {
    res.push(...right.slice(rIndex))
  } else {
    res.push(...left.slice(lIndex))
  }

  return res
}

module.exports = { merge, stableSort }
