import "dotenv/config";
import { listProducts } from "../../src/server/catalog/queries";
import { getSearchEngine } from "../../src/server/search/engine";
for (const q of ["headphone", "trainers", "sofa", "cofee", "jumper", "watch", "'; drop table products--"]) {
  const page = await listProducts({ filters: { query: q }, perPage: 4 });
  console.log(`"${q}" -> ${page.total} [${page.items.map((i) => i.title).join(", ")}]`);
}
const s = await getSearchEngine().suggest("noc");
console.log("suggest 'noc':", s.map((x) => `${x.type}:${x.label}`).join(" | "));
process.exit(0);
