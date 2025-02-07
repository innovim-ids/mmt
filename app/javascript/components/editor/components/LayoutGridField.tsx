/* eslint-disable react/state-in-constructor */
/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { FunctionComponent } from 'react'
import { Col } from 'react-bootstrap'
import {
  cloneDeep,
  has, kebabCase, uniqueId
} from 'lodash'
import {
  ErrorSchema, FieldProps, GenericObjectType, getUiOptions
} from '@rjsf/utils'
import { observer } from 'mobx-react'
import './LayoutGridField.css'
import { MetadataService } from '../services/MetadataService'
import Status from '../model/Status'
import { CmrResponseType, createResponseFromKeywords, getKeywords } from '../utils/cmr_keywords'
import CustomSelectWidget from './widgets/CustomSelectWidget'
import { removeEmpty, createPath, convertToDottedNotation } from '../utils/json_utils'
import CustomTextWidget from './widgets/CustomTextWidget'

type ComponentProps = {
  [name: string]: any
};

interface LayoutGridSchemaProps extends FieldProps {
  [Key: string]: any
}

/** Type used for the state of the `ObjectField` component */
type LayoutGridSchemaState = {
  cmrResponse: CmrResponseType;
  values: any;
  loading: boolean
};

/**
 * Custom field component for react-jsonschema-form which provides support for bootstrap grid system.
 * Code is based off:
 * https://github.com/audibene-labs/react-jsonschema-form-layout/blob/master/src/index.js
 */
class LayoutGridField extends React.Component<FieldProps, LayoutGridSchemaState> {
  // eslint-disable-next-line react/static-property-placement
  private scrollRef: React.RefObject<HTMLFieldSetElement>

  constructor(props: LayoutGridSchemaProps) {
    super(props)
    this.scrollRef = React.createRef()
    this.state = {
      cmrResponse: {} as CmrResponseType,
      values: {},
      loading: false
    }
  }

  componentDidMount() {
    const { uiSchema, registry } = this.props
    const { formContext } = registry
    const { editor } = formContext

    const service = uiSchema['ui:service'] as MetadataService
    const controlled = uiSchema['ui:controlled'] || {}
    const { name, keywords } = controlled

    if (name) {
      this.setState({ loading: true }, () => {
        service.fetchCmrKeywords(name).then((response: CmrResponseType) => {
          this.setState({ loading: false, cmrResponse: response })
        })
          .catch(() => {
            this.setState({ loading: false })
            setTimeout(() => {
              /* istanbul ignore next */
              editor.status = new Status('warning', 'Error retrieving keywords')
            })
          })
      })
    }

    if (keywords) {
      const { map } = controlled
      const { keywords } = controlled
      this.setState({ cmrResponse: createResponseFromKeywords(keywords, Object.values(map)) })
    }
  }

  /* istanbul ignore next */
  onPropertyChange = (name: string, addedByAdditionalProperties = false) => (value: any | undefined, newErrorSchema?: ErrorSchema, id?: string) => {
    const { formData, onChange, errorSchema } = this.props
    if (value === undefined && addedByAdditionalProperties) {
      // Don't set value = undefined for fields added by
      // additionalProperties. Doing so removes them from the
      // formData, which causes them to completely disappear
      // (including the input field for the property name). Unlike
      // fields which are "mandated" by the schema, these fields can
      // be set to undefined by clicking a "delete field" button, so
      // set empty values to the empty string.
      // eslint-disable-next-line no-param-reassign
      value = '' as unknown as any
    }
    const newFormData = { ...formData, [name]: value } as unknown as any
    onChange(
      newFormData,
      errorSchema
      && errorSchema && {
        ...errorSchema,
        [name]: newErrorSchema
      },
      id
    )
  }
  /* istanbul ignore next */
  getAvailableKey = (preferredKey: string, formData?: any) => {
    const { uiSchema } = this.props
    const { duplicateKeySuffixSeparator = '-' } = getUiOptions(uiSchema)

    let index = 0
    let newKey = preferredKey
    while (has(formData, newKey)) {
      // eslint-disable-next-line no-plusplus
      newKey = `${preferredKey}${duplicateKeySuffixSeparator}${++index}`
    }
    return newKey
  }

  /* istanbul ignore next */
  onKeyChange = (oldValue: any) => (value: string, newErrorSchema: ErrorSchema) => {
    if (oldValue === value) {
      return
    }
    const { formData, onChange, errorSchema } = this.props

    // eslint-disable-next-line no-param-reassign
    value = this.getAvailableKey(value, formData)
    const newFormData: GenericObjectType = {
      ...(formData as GenericObjectType)
    }
    const newKeys: GenericObjectType = { [oldValue]: value }
    const keyValues = Object.keys(newFormData).map((key) => {
      const newKey = newKeys[key] || key
      return { [newKey]: newFormData[key] }
    })
    const renamedObj = Object.assign({}, ...keyValues)

    onChange(
      renamedObj,
      errorSchema
      && errorSchema && {
        ...errorSchema,
        [value]: newErrorSchema
      }
    )
  }

  // Given the full path, e.g. ContactGroups[1].ContactInformation.ContactMechanisms, it will return the parent's
  // form data, e.g., ContactGroups[1].ContactInformation
  // This algorithm dives into the formData and retrieves the parent's data.
  getParentFormData(path: string): any {
    const parts = path.split('.')
    const { registry } = this.props
    const { formContext } = registry
    const { editor } = formContext
    const { fullData } = editor
    let data: any = removeEmpty(cloneDeep(fullData))
    parts.forEach((part: string) => {
      if (part !== '') {
        // eslint-disable-next-line no-param-reassign
        part = part.replace('.', '')
        const regexp = /^(.*[^\\[]+)\[(\d+)\]/
        const match = part.match(regexp)
        if (match) {
          data = data[match[1]]
          if (data) {
            data = data.at(match[2])
          }
        } else {
          data = data[part]
        }
      }
    })
    return data
  }

  executeScroll = () => this.scrollRef.current.scrollIntoView({ behavior: 'smooth' })

  // Builds the filter for retrieving keywords.
  createFilter(form: any): any {
    const { uiSchema } = this.props
    const controlled = uiSchema['ui:controlled'] || {}
    const { map } = controlled

    const keys = Object.keys(map)
    const object = {}
    keys.forEach((key) => {
      if (form[key]) {
        object[map[key]] = form[key]
      }
    })
    return object
  }

  // Clears form data for all controlled data below the given target key
  // i.e., If the hierarchy has category, topic, term, variable and the
  // specified target key is 'topic', it will clear the form data for term
  // and variable.
  clearFormData(form: any, targetKey: string) {
    let found = false
    const { uiSchema } = this.props
    const controlled = uiSchema['ui:controlled'] || {}
    const { map } = controlled
    const { clearAdditions = [] } = controlled
    const keys = Object.keys(map)
    keys.forEach((key) => {
      const controlKey = map[key]
      if (controlKey === targetKey) {
        found = true
        return
      }
      if (found) {
        // eslint-disable-next-line no-param-reassign
        delete form[key]
      }
    })
    clearAdditions.forEach((name) => {
      const pos = name.lastIndexOf('.')
      if (pos > -1) {
        const parent = name.substring(0, pos)
        let subform = form[parent]
        if (subform) {
          if (!Array.isArray(subform)) {
            subform = [subform]
          }
          const childField = name.substring(pos + 1)
          subform.forEach((obj) => {
          // eslint-disable-next-line no-param-reassign
            delete obj[childField]
          })
        }
      } else {
      // eslint-disable-next-line no-param-reassign
        delete form[name]
      }
    })
    return form
  }

  isRequired(name: string) {
    const { schema } = this.props
    return Array.isArray(schema.required) && schema.required.indexOf(name) !== -1
  }

  renderField(layoutGridSchema: LayoutGridSchemaProps) {
    const {
      uiSchema,
      errorSchema,
      idSchema,
      disabled,
      readonly,
      onBlur,
      onFocus,
      formData = {},
      registry
    } = this.props
    const { schema: s } = this.props
    const { fields, schemaUtils } = registry
    const { SchemaField } = fields
    const schema = schemaUtils.retrieveSchema(s)
    let name
    let render
    if (typeof layoutGridSchema === 'string') {
      name = layoutGridSchema
    } else {
      name = layoutGridSchema.name
      render = layoutGridSchema.render
    }
    let { name: parentName } = this.props
    const pos = parentName.lastIndexOf('-')
    if (pos > -1) {
      parentName = parentName.substring(0, pos)
    }

    if (idSchema[name]) {
      const childIdSchema = idSchema[name]
      const keys = Object.keys(childIdSchema)
      keys.forEach((key) => {
        if (key === '$id') {
          childIdSchema[key] = childIdSchema[key].replace('root', parentName)
        } else {
          childIdSchema[key].$id = childIdSchema[key].$id.replace('root', parentName)
        }
      })
    } else {
      idSchema.$id = name
    }

    if (schema.properties[name] && !render) {
      return (
        <span data-testid={`layout-grid-field__schema-field--${kebabCase(name)}`}>
          <SchemaField
            key={JSON.stringify(name)}
            name={name}
            required={this.isRequired(name)}
            schema={schema.properties[name] as any}
            uiSchema={uiSchema[name]}
            errorSchema={errorSchema[name]}
            idSchema={idSchema[name] ? idSchema[name] : idSchema}
            formData={formData[name]}
            onChange={this.onPropertyChange(name)}
            onBlur={onBlur}
            onFocus={onFocus}
            registry={registry}
            disabled={disabled}
            readonly={readonly}
            onKeyChange={this.onKeyChange(name)}
          />
        </span>
      )
    }
    let UIComponent: FunctionComponent<ComponentProps> = render

    UIComponent = render

    return (
      <span data-testid={`layout-grid-field__schema-field--${kebabCase(name)}`}>
        <UIComponent
          {...this.props}
          name={name}
          formData={formData}
          errorSchema={errorSchema}
          uiSchema={uiSchema}
          schema={schema}
          registry={registry}
        />
      </span>
    )
  }

  renderControlledField(controlName: string, layoutGridSchema: LayoutGridSchemaProps) {
    const {
      uiSchema,
      idSchema,
      onChange,
      formData = {},
      registry
    } = this.props
    const { schemaUtils } = registry
    const { cmrResponse, loading } = this.state
    let { values } = this.state
    const { schema: s } = this.props
    const schema = schemaUtils.retrieveSchema(s)
    let name
    if (typeof layoutGridSchema === 'string') {
      name = layoutGridSchema
    } else {
      name = layoutGridSchema.name
    }
    let { name: parentName } = this.props
    let pos = parentName.lastIndexOf('-')
    if (pos > -1) {
      parentName = parentName.substring(0, pos)
    }

    const filter = this.createFilter(formData ?? {})

    const controlled = uiSchema['ui:controlled'] || {}
    const { map } = controlled
    const { includeParentFormData = false } = controlled
    if (includeParentFormData) {
      let path = createPath(convertToDottedNotation(idSchema.$id))
      pos = path.lastIndexOf('.')
      if (pos > -1) {
        path = path.substring(0, pos)
      }
      const parentFormData = this.getParentFormData(path) ?? {}
      Object.keys(parentFormData).forEach((key) => {
        const newKey = map[key]
        if (newKey) {
          filter[newKey] = parentFormData[key]
        }
      })
    }
    delete filter[controlName]
    const enums = getKeywords(cmrResponse as CmrResponseType, controlName, filter, Object.values(map))
    const sc = schema.properties[name] as any
    if (enums.length > 0) {
      sc.enum = enums
    }

    if (idSchema[name]) {
      const childIdSchema = idSchema[name]
      const keys = Object.keys(childIdSchema)
      keys.forEach((key) => {
        if (key === '$id') {
          childIdSchema[key] = childIdSchema[key].replace('root', parentName)
        } else {
          childIdSchema[key].$id = childIdSchema[key].$id.replace('root', parentName)
        }
      })
    } else {
      idSchema.$id = name
    }
    const fieldUiSchema = uiSchema[name] ?? {}
    const title = fieldUiSchema['ui:title'] ?? name

    const existingValue = formData[name]
    const enumValue = (enums.length > 0) ? enums[0] : ''
    let value = existingValue ?? enumValue

    const { length: enumsLength } = enums
    if (!this.isRequired(name)) {
      enums.unshift(null)
    }

    const widget = fieldUiSchema != null ? fieldUiSchema['ui:widget'] : null
    if (widget === CustomTextWidget) {
      const id = idSchema[name].$id
      const { name: parentName } = this.props
      idSchema[name].$id = id.replace('root', parentName)

      if (enums.length === 1) {
        const [first] = enums
        const priorValue = formData[name]
        formData[name] = first
        value = formData[name]
        if (priorValue !== value) {
          setTimeout(() => {
            /* istanbul ignore next */
            onChange(formData, null)
          })
        }
      }

      return (
        <div
          className="form-group field field-string"
          key={`layout-grid-field__custom-text-widget--${name}-${value}`}
          data-testid={`controlled-fields__custom-text-widget--${kebabCase(name)}`}
        >
          <CustomTextWidget
            key={`${name}-${formData[name]}`}
            id={idSchema[name].$id}
            name={name}
            disabled
            required={this.isRequired(name)}
            label={title}
            value={value}
            onChange={undefined}
            schema={schema.properties[name] as any}
            onBlur={undefined}
            onFocus={undefined}
            registry={registry}
            options={undefined}
            uiSchema={uiSchema}
          />
        </div>
      )
    }

    let placeholder = `Select ${title}`
    if (loading) {
      placeholder = 'Fetching keywords...'
    } else if (enumsLength === 0) {
      placeholder = `No available ${title}`
    }

    return (
      <div
        className="form-group field field-string"
        data-testid={`layout-grid-field__custom-select-widget--${kebabCase(name)}`}
      >
        <CustomSelectWidget
          key={`${name}-${formData[name]}`}
          name={name}
          required={this.isRequired(name)}
          label={title}
          schema={schema.properties[name] as any}
          uiSchema={uiSchema}
          registry={registry}
          value={formData[name]}
          onChange={(value: any) => {
            values = formData
            values[name] = value
            values = this.clearFormData(values, controlName)
            this.setState({ values }, () => {
              onChange(values, null)
            })
          }}
          isLoading={loading}
          placeholder={placeholder}
          onBlur={undefined}
          onFocus={undefined}
          options={undefined}
          disabled={enumsLength === 0}
          id={idSchema[name].$id}
        />
      </div>
    )
  }

  renderCol(layoutGridSchema: LayoutGridSchemaProps) {
    const { children, controlName, ...colProps } = layoutGridSchema['ui:col']

    const group = layoutGridSchema['ui:group']
    const groupDescription = layoutGridSchema['ui:group-description']
    if (group) {
      const {
        registry, idSchema
      } = this.props
      const { fields, formContext } = registry
      const { editor } = formContext
      const { TitleField } = fields
      const { required, schema } = this.props
      const { description = '' } = schema
      const title = group && typeof group === 'string' ? group : null
      if (idSchema.$id === editor.focusField) {
        setTimeout(() => {
          /* istanbul ignore next */
          this.executeScroll()
        })
      }
      return (
        <Col {...colProps} key={JSON.stringify(colProps)}>
          <fieldset
            ref={this.scrollRef}
            className="rjsf-layout-grid-group"
          >
            <span data-testid={`layout-grid-field__col-title-field--${kebabCase(title)}`}>
              {title ? (
                <TitleField
                  name={title}
                  title={title}
                  required={required}
                  onBlur={undefined}
                  onFocus={undefined}
                  options={undefined}
                  idSchema={undefined}
                  id={uniqueId()}
                  onChange={undefined}
                  schema={undefined}
                  readonly={false}
                  disabled={false}
                  registry={registry}
                />
              ) : null}
            </span>
            {groupDescription ? (
              <div className="group-description">
                {description}
              </div>
            ) : null}
            <div className="col-children">
              {this.renderChildren(children, controlName)}
            </div>
          </fieldset>
        </Col>
      )
    }

    return (
      <Col {...colProps}>
        {' '}
        {this.renderChildren(children, controlName)}
      </Col>
    )
  }

  renderRow(layoutGridSchema: LayoutGridSchemaProps) {
    const rows = layoutGridSchema['ui:row']
    const group = layoutGridSchema['ui:group']
    const groupDescription = layoutGridSchema['ui:group-description']
    const groupClassName = layoutGridSchema['ui:group-className']

    if (group) {
      const { registry } = this.props
      const { fields, formContext } = registry
      const { TitleField } = fields
      const { required, schema } = this.props
      const { description = '' } = schema

      const title = group && typeof group === 'string' ? group : null
      return (
        <div className="row-fieldset">
          <fieldset
            className="rjsf-layout-grid-group"
          >
            <span data-testid={`layout-grid-field__row-title-field--${kebabCase(title)}`}>
              {title ? (
                <TitleField
                  name={title}
                  className={groupClassName}
                  title={title}
                  required={required}
                  formContext={formContext}
                  onBlur={undefined}
                  onFocus={undefined}
                  options={undefined}
                  idSchema={undefined}
                  id={uniqueId()}
                  onChange={undefined}
                  schema={undefined}
                  readonly={false}
                  disabled={false}
                  registry={registry}
                />
              ) : null}
            </span>
            {groupDescription ? (
              <div className="group-description">
                {description}
              </div>
            ) : null}
            <div className="row" key={JSON.stringify(rows)}>{this.renderChildren(rows)}</div>
          </fieldset>
        </div>
      )
    }
    return <div className="row row-children" key={JSON.stringify(rows)}>{this.renderChildren(rows)}</div>
  }

  renderChildren(childrenLayoutGridSchema: LayoutGridSchemaProps, controlName: string = undefined) {
    const { registry, schema: s } = this.props
    const { schemaUtils } = registry
    const schema = schemaUtils.retrieveSchema(s)

    return childrenLayoutGridSchema.map((layoutGridSchema: LayoutGridSchemaProps) => (
      <LayoutGridField
        {...this.props}
        key={JSON.stringify(layoutGridSchema)}
        schema={schema}
        layoutGridSchema={layoutGridSchema}
        controlName={controlName}
      />
    ))
  }
  render() {
    const { uiSchema, controlName } = this.props
    let { layoutGridSchema } = this.props
    if (!layoutGridSchema) layoutGridSchema = uiSchema['ui:layout_grid']

    if (layoutGridSchema['ui:row']) {
      return this.renderRow(layoutGridSchema)
    } if (layoutGridSchema['ui:col']) {
      return this.renderCol(layoutGridSchema)
    }
    if (controlName) {
      return this.renderControlledField(controlName, layoutGridSchema)
    }
    return this.renderField(layoutGridSchema)
  }
}
export default observer(LayoutGridField)
