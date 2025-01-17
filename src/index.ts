import { ArgTypes } from '@storybook/api';
import { logger } from '@storybook/client-logger';
import { camelCase, kebabCase } from 'lodash';

import {
  ExtractArgTypesOptions,
  StencilJsonDocs,
  StencilJsonDocsProp,
  StencilJsonDocsMethod,
  StencilJsonDocsEvent,
  StencilJsonDocsStyle,
  StencilJsonDocsSlot,
  StencilJsonDocsPart,
} from './types';

const isValidComponent = (tagName: string) => {
  if (!tagName) {
    return false;
  }
  if (typeof tagName === 'string') {
    return true;
  }
  throw new Error('Provided component needs to be a string. e.g. component: "my-element"');
}

const isValidMetaData = (stencilDocJson: StencilJsonDocs) => {
  if (!stencilDocJson) {
    return false;
  }
  if (stencilDocJson.components && Array.isArray(stencilDocJson.components)) {
    return true;
  }
  throw new Error(`You need to setup valid meta data in your preview.js via setStencilDocJson().
    The meta data can be generated with the stencil output target 'docs-json'.`);
}

const getMetaData = (tagName: string, stencilDocJson: StencilJsonDocs) => {
  if (!isValidComponent(tagName) || !isValidMetaData(stencilDocJson)) {
    return null;
  }

  const metaData = stencilDocJson.components.find(
    (component) => component.tag.toUpperCase() === tagName.toUpperCase()
  );
  if (!metaData) {
    logger.warn(`Component not found in stencil doc json: ${tagName}`);
  }
  return metaData;
};

const mapItemValuesToOptions = (item: StencilJsonDocsProp) => {
  return item.values
    .filter(value => ['string', 'number'].includes(value.type))
    .map(value => value.value);
}

const mapPropTypeToControl = (item: StencilJsonDocsProp): { control: {type: string}, options: (string | number)[] | null } => {
  let control;
  let options: (string | number)[] | null = null;

  switch(item.type) {
    case 'string':
      control = { type: 'text' };
    break;
    case 'number':
      control = { type: 'number' }
    break;
    case 'boolean':
      control = { type: 'boolean' }
    break;
    case 'function':
    case 'void':
      control = null;
    break;
    default:
      options = mapItemValuesToOptions(item);

      if(options.length === 0) {
        control = { type: 'object' };
      } else if(options.length < 5) {
        control = { type: 'radio' };
      } else {
        control = { type: 'select' };
      }
  }

  return { control, options };
}

const mapPropsData = (data: StencilJsonDocsProp[], options: ExtractArgTypesOptions): ArgTypes => {
  const { dashCase } = options;

  return (
    data &&
    data.reduce((acc, item) => {
      const { control, options } = mapPropTypeToControl(item);
      let key = (item.attr || item.name);
      key = dashCase === true ? kebabCase(key) : camelCase(key)

      acc[key] = {
        name: item.attr || item.name,
        description: item.docs,
        type: { required: item.required },
        control: control,
        table: {
          category: 'props',
          type: { summary: item.type },
          defaultValue: { summary: item.default },
        },
      };

      if (options !== null) acc[key].options = options;

      return acc;
    }, {} as ArgTypes)
  );
}

const mapEventsData = (data: StencilJsonDocsEvent[], options: ExtractArgTypesOptions): ArgTypes => {
  const { dashCase } = options;
  return (
    data &&
    data.reduce((acc, item) => {
      let key = `event-${item.event}`;
      key = dashCase === true ? kebabCase(key) : camelCase(key)
      acc[key] = {
        name: item.event,
        action: item.event,
        description: item.docs,
        type: { name: 'void' },
        control: null,
        table: {
          category: 'events',
          type: { summary: item.detail }
        },
      };
      return acc;
    }, {} as ArgTypes)
  );
}

const mapMethodsData = (data: StencilJsonDocsMethod[], options: ExtractArgTypesOptions): ArgTypes => {
  const { dashCase } = options;

  return (
    data &&
    data.reduce((acc, item) => {
      let key = `method-${item.name}`;
      key = dashCase === true ? kebabCase(key) : camelCase(key)
      acc[key] = {
        name: item.name,
        description: item.docs,
        type: { name: 'void' },
        control: null,
        table: {
          category: 'methods',
          type: { summary: item.signature }
        },
      };
      return acc;
    }, {} as ArgTypes)
  );
}

const mapSlotsData = (data: StencilJsonDocsSlot[], options: ExtractArgTypesOptions): ArgTypes => {
  const { dashCase } = options;

  return (
    data &&
    data.reduce((acc, item) => {
      const name = item.name || '_default'
      let key = `slot-${name}`;
      key = dashCase === true ? kebabCase(key) : camelCase(key)
      const type = { name: 'void' };
      acc[key] = {
        name: item.name,
        required: false,
        description: item.docs,
        control: null,
        type,
        table: {
          category: 'slots',
          type,
        },
      };
      return acc;
    }, {} as ArgTypes)
  );
}

const mapGenericData = <T extends {name: string, docs: string}>(data: T[], category: string, options: ExtractArgTypesOptions): ArgTypes => {
  const { dashCase } = options;

  return (
    data &&
    data.reduce((acc, item) => {
      const type = { name: 'void' };
      let key = `${category}-${item.name}`;
      key = dashCase === true ? kebabCase(key) : camelCase(key)
      acc[key] = {
        name: item.name,
        required: false,
        description: item.docs,
        control: null,
        type,
        table: {
          category,
          type,
        },
      };
      return acc;
    }, {} as ArgTypes)
  );
}


/**
 * @param stencilDocJson stencil json doc
 */
export const setStencilDocJson = (stencilDocJson: StencilJsonDocs): void => {
  // @ts-ignore
  window.__STORYBOOK_STENCIL_DOC_JSON__ = stencilDocJson;
};

// @ts-ignore
export const getStencilDocJson = ():StencilJsonDocs => window.__STORYBOOK_STENCIL_DOC_JSON__;

/**
 * @param {string} tagName - stencil component for which to extract ArgTypes
 * @param {StencilJsonDocs} stencilDocJson - Stencil meta data from `docs-json` output target
 */
export const extractArgTypesFromElements = (
  tagName: string,
  stencilDocJson: StencilJsonDocs,
  options: ExtractArgTypesOptions
): ArgTypes => {
  const metaData = getMetaData(tagName, stencilDocJson);

  return (
    metaData && {
      ...mapPropsData(metaData.props, options),
      ...mapEventsData(metaData.events, options),
      ...mapMethodsData(metaData.methods, options),
      ...mapSlotsData(metaData.slots, options),
      ...mapGenericData<StencilJsonDocsStyle>(metaData.styles, 'css custom properties', options),
      ...mapGenericData<StencilJsonDocsPart>(metaData.parts, 'css shadow parts', options),
    }
  );
};

/**
 * @param {Partial<ExtractArgTypesOptions>} options - options for extractArgTypes
 */
export const extractArgTypesFactory = (
  options: Partial<ExtractArgTypesOptions> = {}
): (tagName: string) => ArgTypes => {
  return (tagName: string): ArgTypes => {
    return extractArgTypesFromElements(tagName, getStencilDocJson(), {
      dashCase: false,
      ...options
    });
  }
};

/**
 * @param {string} tagName - stencil component for which to extract ArgTypes
 */
export const extractArgTypes = extractArgTypesFactory();


/**
 * @param {string} tagName - stencil component for which to extract description
 */
export const extractComponentDescription = (tagName: string): string => {
  const metaData = getMetaData(tagName, getStencilDocJson());
  return metaData && (metaData.readme || metaData.docs);
};
