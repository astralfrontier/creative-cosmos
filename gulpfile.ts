import fs from "node:fs";
import path from "node:path";
import ogs from "open-graph-scraper";
import { prompt } from "enquirer";
import yaml from "yaml";
import { pathOr, pluck } from "ramda";
import slugify from "slugify";

const tagDictionaryPath = path.join(__dirname, "tags.yaml");
const tagDictionary = yaml.parse(fs.readFileSync(tagDictionaryPath).toString());

type GulpCallback = (error?: any) => void;

async function scrapeUrl() {
  const options: Record<any, any> = await prompt({
    type: "input",
    name: "url",
    message: "URL to include?",
    initial: "https://ogp.me",
  });
  const { result } = await ogs(options);
  const choices = pluck("name", tagDictionary);
  let frontmatter: Record<string, any> = await prompt([
    {
      type: "input",
      name: "title",
      message: "Title",
      initial: result.ogTitle,
    },
    {
      type: "input",
      name: "imageUrl",
      message: "Image URL",
      initial: pathOr("", ["ogImage", 0, "url"], result),
    },
    {
      type: "autocomplete",
      name: "tags",
      message: "Tags? (space selects)",
      choices,
      multiple: true,
    },
  ]);
  frontmatter["url"] = options["url"];

  const filename = path.join(
    __dirname,
    "entries",
    slugify(frontmatter["title"] as string, {
      lower: true, // convert to lower case, defaults to `false`
      strict: true, // strip special characters except replacement, defaults to `false`
      trim: true, // trim leading and trailing replacement chars, defaults to `true`
    })
  );

  const contents = `---\n${yaml.stringify(frontmatter)}---\n\n${
    result.ogDescription || "No description"
  }\n`;

  fs.writeFileSync(`${filename}.md`, contents);
  // TODO: cache image
}

function defaultTask(cb: GulpCallback) {
  console.log("hello world");
  cb();
}

exports.default = scrapeUrl;
