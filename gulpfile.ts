import fs from "node:fs";
import path from "node:path";
import ogs from "open-graph-scraper";
import { prompt } from "enquirer";
import yaml from "yaml";
import { assoc, pathOr, pluck, reduce } from "ramda";
import slugify from "slugify";

interface Tag {
  name: string;
  desc?: string;
  parents?: string[];
  img?: string;
}

const tagDictionaryPath = path.join(__dirname, "tags.yaml");
const tagDictionary: Tag[] = yaml.parse(
  fs.readFileSync(tagDictionaryPath).toString()
);

type GulpCallback = (error?: any) => void;

function validateTagHierarchy(cb: GulpCallback) {
  let errors: string[] = [];
  const tagNames = pluck("name", tagDictionary);
  for (let tag of tagDictionary) {
    for (let parent of tag.parents || []) {
      if (!tagNames.includes(parent)) {
        errors.push(`${tag.name} mentions unknown parent ${parent}`);
      }
    }
  }
  cb(errors.join("\n"));
}

async function scrapeUrl() {
  const options: Record<any, any> = await prompt({
    type: "input",
    name: "url",
    message: "URL to include?",
    initial: "https://ogp.me",
  });
  let defaults: any = {};
  try {
    const { result } = await ogs(options);
    defaults = { ...result };
  } catch (e) {
    console.error("Unable to read OG results");
  }
  const choices = pluck("name", tagDictionary);
  let frontmatter: Record<string, any> = await prompt([
    {
      type: "input",
      name: "title",
      message: "Title",
      initial: defaults.ogTitle,
    },
    {
      type: "input",
      name: "imageUrl",
      message: "Image URL",
      initial: pathOr("", ["ogImage", 0, "url"], defaults),
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
    defaults.ogDescription || "No description"
  }\n`;

  fs.writeFileSync(`${filename}.md`, contents);
  // TODO: cache image
}

exports.default = scrapeUrl;
exports.validateTagHierarchy = validateTagHierarchy;
