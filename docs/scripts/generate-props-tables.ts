import fs from 'fs';
import path from 'path';
import { globbyStream } from 'globby';
import { getCatalog } from './util/getCatalog';
import { getAllTypesData } from './util/getAllTypesData';
import type {
  Catalog,
  Category,
  ComponentName,
  Properties,
} from './types/catalog';
import { TypeFileName } from './types/allTypesData';

const catalog = getCatalog();
const { allTypeFilesInterfaceData } = getAllTypesData();

createAllPropsTables();

async function createAllPropsTables() {
  for await (const componentFilepath of globbyStream(
    path.join(
      __dirname,
      '../../docs/src/pages/[platform]/components/*/[tab]/index.page.mdx'
    )
  )) {
    const regex =
      /src\/pages\/\[platform\]\/components\/(\w*)\/\[tab\]\/index\.page\.mdx/;
    const componentPageName = (componentFilepath as string).match(
      regex
    )[1] as Lowercase<ComponentName>;
    const properties = getObjectValueWithCaselessKey(
      catalog,
      componentPageName
    );

    const propsSortedByCategory = getPropsSortedByCategory(
      properties,
      componentPageName
    );

    if (!propsSortedByCategory) {
      console.log(`❗️ Not generating props table for ${componentPageName}`);
      continue;
    }

    const componentName = Object.keys(
      propsSortedByCategory[0]
    )[0] as ComponentName;

    const mainPropsTable = PropsTable(
      Object.values(propsSortedByCategory[0])[0]
    );

    const expander = PropsTableExpander(propsSortedByCategory.slice(1));

    fs.writeFileSync(
      path.join(
        __dirname,
        '../../docs/src/pages/[platform]/components/',
        `./${componentPageName}/[tab]/props-table.mdx`
      ),
      Output(componentName, mainPropsTable, expander)
    );
    console.log(`✅ ${componentPageName} Props Tables are updated.`);
  }
}

type CategoryProperty = { [key in Category]: Properties };
type SortedPropertiesByCategory = { [key: string]: Properties }[];
type PropertiesByCategory = Record<Category, Properties>;

/**
 * @todo After Marketing Launch 2022-06, to update the note under the Props Heading to specify the HTML element's name and MDN link.
 */
function Output(displayName, mainPropsTable, tableExpander) {
  return `
{/* DO NOT EDIT DIRECTLY */}
{/* This file is autogenerated by "docs/scripts/generate-props-tables.ts" script. */}
{/* See Docs README to generate */}
import { Expander, ExpanderItem, Table, TableBody, TableCell, TableHead, TableRow } from '@aws-amplify/ui-react';

${mainPropsTable}

${tableExpander}

\`*\` indicates required props.

The ${displayName} will accept any of the standard HTML attributes that a HTML element accepts. Standard element attributes can be found in the [MDN Documentation](https://developer.mozilla.org/en-US/docs/Web/HTML/Element).
`;
}

function PropsTableExpander(propsSortedByCategory: SortedPropertiesByCategory) {
  const expanderItem = (categoryProperty: CategoryProperty): string => {
    const title = Object.keys(categoryProperty)[0];
    const table = PropsTable(categoryProperty[title]);
    return `
<ExpanderItem title="${title}" value="${title}">
    ${table}
</ExpanderItem>
`;
  };

  return `
<Expander type="multiple" className="props-table-expander" >
  ${propsSortedByCategory.map(expanderItem).join('')}
</Expander>
`;
}

function PropsTable(properties: Properties) {
  const rows = Object.entries(properties)
    .sort(([propNameA], [propNameB]) => propNameA.localeCompare(propNameB))
    .map(
      ([propName, { name, type, description, isOptional }]) => `
    <TableRow>
      <TableCell className="props-table__tr-name">${name}${
        isOptional ? '' : '<sup>*</sup>'
      }</TableCell>
      <TableCell>${`
\`\`\`jsx
${type}
\`\`\`
`}</TableCell>
      <TableCell className="props-table__tr-description">${
        description ? description : '-'
      }</TableCell>
    </TableRow>
`
    );
  return `
<Table
  highlightOnHover={true}
  className="props-table"
  >
  <TableHead>
    <TableRow>
      <TableCell as="th">Name</TableCell>
      <TableCell as="th">Type</TableCell>
      <TableCell as="th">Description</TableCell>
    </TableRow>
  </TableHead>
  <TableBody>
    ${rows.join('')}
  </TableBody>
</Table>
`;
}

function getPropsSortedByCategory(
  properties: Properties,
  componentPageName: Lowercase<ComponentName>
): SortedPropertiesByCategory {
  if (properties) {
    let propertiesByCategory: PropertiesByCategory =
      getPropertiesByCategory(componentPageName);

    const componentName =
      Object.keys(propertiesByCategory).find(
        (category) => category.toLowerCase() === componentPageName
      ) ?? (componentPageName as ComponentName | Lowercase<ComponentName>);

    const allTableCategories: {
      [key in 'Main' | 'Base' | 'Layout' | 'Styling']: Category[];
    } = {
      Main: [],
      Base: ['BaseComponentProps', 'Base'],
      Layout: [
        'CSSLayoutStyleProps',
        'FlexContainerStyleProps',
        'FlexItemStyleProps',
        'GridContainerStyleProps',
        'GridItemStyleProps',
      ],
      Styling: ['BaseStyleProps'],
    };

    const isPropMainCategory = (category) => {
      const customCategory = { link: ['AnchorHTMLAttributes'] };
      const isCurrentComponentProp = category
        .toLowerCase()
        .includes(componentName.toLowerCase());
      const isPropsOrOptions = category.toLowerCase().match(/props|options/);
      const isSharedBasicCategory = Object.values(allTableCategories).find(
        (propArr) => propArr.includes(category)
      );
      const isCustomCategory =
        customCategory[componentName.toLowerCase()]?.includes(category);
      return (
        isCurrentComponentProp ||
        (isPropsOrOptions && !isSharedBasicCategory) ||
        isCustomCategory
      );
    };

    allTableCategories.Main = Object.keys(propertiesByCategory).filter(
      isPropMainCategory
    ) as Category[];

    return Object.keys(allTableCategories)
      .map((category) => {
        switch (category) {
          case 'Main':
            return {
              Main: combineCategories(
                propertiesByCategory,
                allTableCategories.Main
              ),
            };
          case 'Base':
            return {
              Base: combineCategories(
                propertiesByCategory,
                allTableCategories.Base
              ),
            };
          case 'Layout':
            return {
              Layout: combineCategories(
                propertiesByCategory,
                allTableCategories.Layout
              ),
            };
          case 'Styling':
            return {
              Styling: combineCategories(propertiesByCategory, [
                'BaseStyleProps',
              ]),
            };
          default:
            break;
        }
      })
      .filter((val) => Object.values(val)[0]);
  } else {
    console.log(` 🫥  ${componentPageName} doesn't have any type properties.`);
    return null;
  }
}

function combineCategories(propertiesByCategory, toBeCombined: Category[]) {
  return toBeCombined.reduce(
    (acc, category) => ({
      ...acc,
      ...getObjectValueWithCaselessKey(propertiesByCategory, category),
    }),
    {}
  );
}

function getPropertiesByCategory(
  componentPageName: Lowercase<ComponentName>
): PropertiesByCategory {
  let propertiesByCategory: PropertiesByCategory = {} as PropertiesByCategory;

  /**
   * Some special components don't have accurate properties generated from getCatalog, so we have to manually point it to AllTypesData as well in addition to the Catalog.
   * First element is the component's name
   */
  const specialComponents = {
    view: ['View', 'Input'],
    textfield: ['TextField', 'TextInputField', 'TextArea', 'Input', 'Field'],
    text: ['Text'],
  };

  for (const propertyName in getObjectValueWithCaselessKey(
    catalog,
    componentPageName
  )) {
    const property = getObjectValueWithCaselessKey(catalog, componentPageName)[
      propertyName
    ];
    propertiesByCategory = {
      ...propertiesByCategory,
      [property.category]: {
        ...propertiesByCategory[property.category],
        [propertyName]: property,
      },
    };
  }
  if (Object.keys(specialComponents).includes(componentPageName)) {
    const componentName = specialComponents[componentPageName][0];
    propertiesByCategory = {
      ...propertiesByCategory,
      [componentName]: {
        ...propertiesByCategory[componentName],
        ...getPropertiesFromAllTypeData(specialComponents[componentPageName]),
      },
    };
  }
  return propertiesByCategory;
}

function getPropertiesFromAllTypeData(sourceTypes: TypeFileName[]) {
  let targetProps: Properties;

  sourceTypes.forEach((type) => {
    if (!allTypeFilesInterfaceData.get(type)) return;
    for (const [propName, property] of allTypeFilesInterfaceData
      .get(type)
      .entries()) {
      targetProps = {
        ...targetProps,
        [propName]: {
          name: String(property.get('name')),
          type: String(property.get('type')),
          description: property.get('description')
            ? (property.get('description') as { description: string })
                .description
            : '',
          category: property.get('category') as Category,
          isOptional: property.get('isOptional') as boolean,
        },
      };
    }
  });
  return targetProps;
}

/**
 *
 * @name getProperties
 * @description case-insensitively get the values from an object
 */
function getObjectValueWithCaselessKey(
  object: PropertiesByCategory | Catalog,
  key:
    | ComponentName
    | Lowercase<ComponentName>
    | Category
    | Lowercase<Category>
    | 'Other'
): Properties;
function getObjectValueWithCaselessKey(object, key) {
  const asLowercase = key.toLowerCase();
  return object[
    Object.keys(object).find((k) => k.toLowerCase() === asLowercase)
  ];
}
