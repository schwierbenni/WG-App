export const shoppingCategories = [
  { id: 'LEBENSMITTEL', label: 'Lebensmittel' },
  { id: 'GEWUERZE', label: 'Gewürze' },
  { id: 'REINIGUNGSMITTEL', label: 'Reinigungsmittel' },
  { id: 'HAUSHALT', label: 'Haushalt' },
  { id: 'SONSTIGES', label: 'Sonstiges' },
] as const

type Category = (typeof shoppingCategories)[number]['id']

function normalize(value: string) {
  return value.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
}

const keywords = {
  REINIGUNGSMITTEL: 'wc wcreiniger reiniger putzmittel allzweckreiniger badreiniger glasreiniger spueli spuelmittel spuelmaschinentabs geschirrspueltabs tabs schwamm schwaemme putzschwamm putzschwaemme scheuermilch entkalker waschmittel weichspueler',
  HAUSHALT: 'klopapier toilettenpapier wcpapier wcrolle wcrollen zewa kuechenpapier kuechenrolle kuechenrollen kuechentuch kuechentuecher taschentuecher muelltuete muelltueten muellbeutel muellsaecke streichholz streichhoelzer backpapier alufolie frischhaltefolie gefrierbeutel batterien kerzen',
  GEWUERZE: 'gewuerz gewuerze gemuesebruehe huehnerbruehe rinderbruehe bruehe bruehwuerfel bouillon salz pfeffer paprikaedelsuess paprikapulver currypulver curry kurkuma oregano basilikum zimt muskat kreuzkuemmel kuemmel chiliflocken knoblauchpulver lorbeer gewuerzmischung',
  LEBENSMITTEL: 'zwiebel zwiebeln knoblauch kartoffel kartoffeln milch hafermilch soja haferdrink butter kaese joghurt quark sahne eier ei brot broetchen reis nudeln pasta tomate tomaten gurke gurken salat paprika apfel aepfel banane bananen obst gemuese karotte karotten moehre moehren mehl zucker oel olivenoel sonnenblumenoel rapsoel essig mayo mayonnaise ketchup senf kaffee kaffeebohnen kaffeepulver tee wasser saft bier fleisch hackfleisch tofu linsen bohnen erbsen haferflocken cornflakes muesli schokolade kekse',
} satisfies Record<Exclude<Category, 'SONSTIGES'>, string>

const groups = Object.entries(keywords).map(([category, words]) => ({
  category: category as Exclude<Category, 'SONSTIGES'>,
  words: words.split(' '),
}))

function oneEditApart(word: string, candidate: string) {
  if (Math.abs(word.length - candidate.length) > 1) return false
  let i = 0
  while (i < word.length && word[i] === candidate[i]) i++
  if (word.length === candidate.length) {
    return word.slice(i + 1) === candidate.slice(i + 1) ||
      (word[i] === candidate[i + 1] && word[i + 1] === candidate[i] &&
        word.slice(i + 2) === candidate.slice(i + 2))
  }
  const longer = word.length > candidate.length ? word : candidate
  const shorter = word.length > candidate.length ? candidate : word
  return longer.slice(i + 1) === shorter.slice(i)
}

export function categorizeShoppingItem(name: string, previous?: string | null): Category {
  const words = normalize(name.replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')).match(/[a-z]+/g) ?? []
  const compounds = words.slice(1).map((word, i) => words[i] + word)
  for (const candidates of [compounds, words]) {
    for (const group of groups) {
      if (candidates.some((word) => group.words.includes(word))) return group.category
    }
  }
  const fuzzy = groups.filter((group) => words.some((word) =>
    word.length >= 5 && group.words.some((candidate) => candidate.length >= 5 && oneEditApart(word, candidate))
  ))
  if (fuzzy.length === 1) return fuzzy[0].category
  return shoppingCategories.find(({ id }) => id === previous)?.id ?? 'SONSTIGES'
}
