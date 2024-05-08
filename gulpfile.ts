import * as fs from "fs";
import * as path from "path";
import ogs from "open-graph-scraper";
import { prompt } from "enquirer";
import * as yaml from "yaml";
import { pathOr, pluck } from "ramda";
import slugify from "slugify";
import * as FileHound from "filehound";
import * as matter from "gray-matter";
import * as fileTypeChecker from "file-type-checker";

interface Tag {
  name: string;
  desc?: string;
  parents?: string[];
  img?: string;
}

interface EntryOptions {
  url: string;
}

interface EntryAnswers {
  title: string;
  imageUrl: string;
  tags: string[];
  path: string;
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
  const entriesFolders = fs
    .readdirSync(path.join(__dirname, "entries"), {
      withFileTypes: true,
    })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);
  const options: EntryOptions = await prompt({
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
  const tags = pluck("name", tagDictionary);
  let answers: EntryAnswers = await prompt([
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
      choices: tags,
      multiple: true,
    },
    {
      type: "autocomplete",
      name: "path",
      message: "Path",
      choices: entriesFolders,
    },
  ]);

  const frontmatter = {
    title: answers["title"],
    url: options["url"],
    imageUrl: answers["imageUrl"],
    tags: answers["tags"],
  };

  const filename = path.join(
    __dirname,
    "entries",
    answers["path"],
    slugify(answers["title"] as string, {
      lower: true, // convert to lower case, defaults to `false`
      strict: true, // strip special characters except replacement, defaults to `false`
      trim: true, // trim leading and trailing replacement chars, defaults to `true`
    })
  );

  // TODO: infer path from tags list

  const contents = `---\n${yaml.stringify(frontmatter)}---\n\n${
    defaults.ogDescription || "No description"
  }\n`;

  fs.writeFileSync(`${filename}.md`, contents);
}

async function cacheImage(file: string) {
  const data = matter(fs.readFileSync(file).toString());
  if (data.data && data.data.imageUrl) {
    console.log(`Fetching ${data.data.imageUrl}`);
    const response = await fetch(data.data.imageUrl);
    const buffer = Buffer.from(await response.arrayBuffer());
    const { extension } = await fileTypeChecker.detectFile(buffer);
    const imagePath = path.format({
      ...path.parse(file),
      base: `${path.basename(file, path.extname(file))}.${extension}`,
    });
    fs.writeFileSync(imagePath, buffer);
    console.log(`Wrote ${imagePath}`);
  } else {
    console.log(`No imageUrl for ${file}`);
  }
}

async function cacheImages() {
  const files: string[] = await FileHound.create()
    .paths("entries")
    .ext("md")
    .find();
  for (let file of files) {
    await cacheImage(file);
  }
}

exports.default = scrapeUrl;
exports.cacheImages = cacheImages;
exports.validateTagHierarchy = validateTagHierarchy;
