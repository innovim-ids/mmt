import React from 'react'
import Form from '@rjsf/bootstrap-4'
import {
  render, fireEvent, screen, waitFor, within
} from '@testing-library/react'
import {
  BrowserRouter,
  MemoryRouter, Route, Routes
} from 'react-router-dom'
import { createSchemaUtils } from '@rjsf/utils'
import validator from '@rjsf/validator-ajv8'
import userEvent from '@testing-library/user-event'
import { act } from 'react-dom/test-utils'
import CustomSelectWidget from '../CustomSelectWidget'
import UmmVarModel from '../../../model/UmmVarModel'
import MetadataEditor from '../../../MetadataEditor'
import MetadataEditorForm from '../../MetadataEditorForm'
import mimeTypeKeywords from '../../../data/test/mime_type_keywords'
import { MetadataService } from '../../../services/MetadataService'
import UmmToolsModel from '../../../model/UmmToolsModel'

global.fetch = require('jest-fetch-mock')

describe('Var Keywords test with keywords from CMR', () => {
  const metadataService = new MetadataService('test_token', 'test_drafts', 'test_user', 'provider')

  it('fetches CMR keywords and updates', async () => {
    const model = new UmmVarModel()
    const editor = new MetadataEditor(model)

    const uiSchema = {
      'ui:title': 'Mime Type',
      'ui:controlled': {
        name: 'mime-type',
        controlName: 'mime_type'
      },
      'ui:service': metadataService,
      'ui:widget': CustomSelectWidget
    }
    jest.spyOn(MetadataService.prototype, 'fetchCmrKeywords').mockResolvedValue(mimeTypeKeywords)

    const props = {
      label: 'Mime Type',
      required: true,
      schema: {},
      registry: {
        schemaUtils: createSchemaUtils(validator, {}),
        formContext: { editor }
      },
      options: {
        title: 'My Test Data Label'
      },
      uiSchema
    }
    const { container } = render(
      <BrowserRouter>
        <CustomSelectWidget {...props} />
      </BrowserRouter>
    )

    const mimeTypeComponent = screen.queryByTestId('custom-select-widget__mime-type--selector').firstChild

    expect(mimeTypeComponent).not.toBeNull()
    await act(async () => {
      fireEvent.keyDown(mimeTypeComponent, { key: 'ArrowDown' })
      fireEvent.click(mimeTypeComponent)
    })
    expect(mimeTypeComponent).toHaveTextContent('application/gzip')
    expect(container).toMatchSnapshot()
  })

  it('testing for error retrieving CMR keywords', async () => {
    const model = new UmmVarModel()
    const editor = new MetadataEditor(model)

    const uiSchema = {
      'ui:title': 'Mime Type',
      'ui:controlled': {
        name: 'mime-type',
        controlName: 'mime_type'
      },
      'ui:service': metadataService,
      'ui:widget': CustomSelectWidget
    }

    const props = {
      label: 'Mime Type',
      required: true,
      schema: {},
      registry: {
        schemaUtils: createSchemaUtils(validator, {}),
        formContext: { editor }
      },
      options: {
        title: 'My Test Data Label'
      },
      uiSchema
    }
    jest.spyOn(MetadataService.prototype, 'fetchCmrKeywords').mockRejectedValue('Error retrieving keywords')
    const status = jest.spyOn(MetadataEditor.prototype, 'status', 'set')
    const { container } = render(
      <BrowserRouter>
        <CustomSelectWidget {...props} />
      </BrowserRouter>
    )
    await act(async () => null) // Popper update() - https://github.com/popperjs/react-popper/issues/350
    expect(status).toBeCalledWith({ type: 'warning', message: 'Error retrieving mime-type keywords' })
    expect(container).toMatchSnapshot()
  })
})

describe('Custom Select Widget Component', () => {
  const model = new UmmToolsModel()
  const editor = new MetadataEditor(model)

  it('renders the custom select widget when no enum', async () => {
    const props = {
      label: 'MyTestDataLabel',
      required: false,
      schema: {},
      registry: { schemaUtils: createSchemaUtils(validator, {}), formContext: { editor } },
      onChange: {},
      value: 'Web Portal'
    }
    const { container } = render(
      <BrowserRouter>
        <CustomSelectWidget {...props} />
      </BrowserRouter>
    )
    expect(screen.getByTestId('custom-select-widget__my-test-data-label')).not.toHaveTextContent('My Test Data Label*')
    expect(screen.getByTestId('custom-select-widget__my-test-data-label--selector')).toHaveTextContent('Web Portal')
    expect(container).toMatchSnapshot()
  })

  it('renders the custom select widget when no option', async () => {
    const model = new UmmToolsModel()
    const editor = new MetadataEditor(model)
    const schema = {
      enum: []
    }
    const props = {
      label: 'MyTestDataLabel',
      required: false,
      schema,
      registry: {
        schemaUtils: createSchemaUtils(validator, schema),
        formContext: { editor }
      },
      options: {
        title: ''
      },
      onChange: {}
    }
    const { container } = render(
      <BrowserRouter>
        <CustomSelectWidget {...props} />
      </BrowserRouter>
    )
    expect(screen.getByTestId('custom-select-widget__my-test-data-label')).not.toHaveTextContent('My Test Data Label*')
    expect(screen.getByTestId('custom-select-widget__my-test-data-label--selector')).not.toHaveTextContent('Web Portal')
    expect(container).toMatchSnapshot()
  })
  it('renders the custom select widget when required field', async () => {
    const model = new UmmToolsModel()
    const editor = new MetadataEditor(model)
    const schema = {
      enum: ['Option1', 'Option2', 'Option3', 'Option4']
    }
    const props = {
      label: 'MyTestDataLabel',
      required: true,
      schema,
      registry: {
        schemaUtils: createSchemaUtils(validator, schema),
        formContext: { editor }
      },
      options: {
        title: 'My Test Data Label'
      },
      onChange: {}
    }
    const { container } = render(
      <BrowserRouter>
        <CustomSelectWidget {...props} />
      </BrowserRouter>
    )
    expect(screen.getByTestId('custom-select-widget__my-test-data-label')).toHaveTextContent('My Test Data Label')
    expect(container).toMatchSnapshot()
  })

  it('renders the custom select widget when required field without title', async () => {
    const model = new UmmToolsModel()
    const editor = new MetadataEditor(model)
    const schema = {
      enum: ['Option1', 'Option2', 'Option3', 'Option4']
    }
    const props = {
      label: 'MyTestDataLabel',
      required: true,
      schema,
      registry: {
        schemaUtils: createSchemaUtils(validator, schema),
        formContext: { editor }
      },
      onChange: {}
    }
    const { container } = render(
      <BrowserRouter>
        <CustomSelectWidget {...props} />
      </BrowserRouter>
    )
    expect(screen.getByTestId('custom-select-widget__my-test-data-label')).toHaveTextContent('MyTestDataLabel')
    expect(container).toMatchSnapshot()
  })
  it('should call onChange when the first option is selected then second option', async () => {
    const model = new UmmToolsModel()
    const editor = new MetadataEditor(model)
    const mockedOnChange = jest.fn()
    const schema = {
      enum: ['Option1', 'Option2', 'Option3', 'Option4']
    }
    const props = {
      label: 'MyTestDataLabel',
      required: true,
      schema,
      registry: {
        schemaUtils: createSchemaUtils(validator, schema),
        formContext: { editor }
      },
      options: {
        title: 'My Test Data Label'
      },
      onChange: mockedOnChange
    }
    const { container, getByText, queryByTestId } = render(
      <BrowserRouter>
        <CustomSelectWidget {...props} />
      </BrowserRouter>
    )

    const mySelectComponent = queryByTestId('custom-select-widget__my-test-data-label--selector')

    expect(mySelectComponent).toBeDefined()
    expect(mySelectComponent).not.toBeNull()
    expect(mockedOnChange).toHaveBeenCalledTimes(0)
    await waitFor(async () => {
      fireEvent.keyDown(mySelectComponent.firstChild, { key: 'ArrowDown' })
    })
    fireEvent.click(await getByText('Option1'))
    expect(mockedOnChange).toHaveBeenCalledWith('Option1')

    fireEvent.keyDown(mySelectComponent.firstChild, { key: 'ArrowDown' })
    fireEvent.click(await getByText('Option3'))
    expect(mockedOnChange).toHaveBeenCalledWith('Option3')

    expect(mockedOnChange).toHaveBeenCalledTimes(2)
    await waitFor(async () => {
      userEvent.tab()
    })
    expect(container).toMatchSnapshot()
  })

  it('select box works with items enums as well', async () => {
    const model = new UmmToolsModel()
    const editor = new MetadataEditor(model)
    const mockedOnChange = jest.fn()
    const schema = {
      items: {
        enum: ['Option1', 'Option2', 'Option3', 'Option4']
      }
    }
    const props = {
      label: 'MyTestDataLabel',
      required: true,
      schema,
      registry: {
        schemaUtils: createSchemaUtils(validator, schema),
        formContext: { editor }
      },
      options: {
        title: 'My Test Data Label'
      },
      onChange: mockedOnChange
    }
    const { container, getByText, queryByTestId } = render(
      <BrowserRouter>
        <CustomSelectWidget {...props} />
      </BrowserRouter>
    )

    const mySelectComponent = queryByTestId('custom-select-widget__my-test-data-label--selector')

    expect(mySelectComponent).toBeDefined()
    expect(mySelectComponent).not.toBeNull()
    expect(mockedOnChange).toHaveBeenCalledTimes(0)

    fireEvent.keyDown(mySelectComponent.firstChild, { key: 'ArrowDown' })
    fireEvent.click(await getByText('Option1'))
    expect(mockedOnChange).toHaveBeenCalledWith('Option1')

    fireEvent.keyDown(mySelectComponent.firstChild, { key: 'ArrowDown' })
    fireEvent.click(await getByText('Option3'))
    expect(mockedOnChange).toHaveBeenCalledWith('Option3')

    expect(mockedOnChange).toHaveBeenCalledTimes(2)
    expect(container).toMatchSnapshot()
  })

  it('testing autofocus for a custom select widget', async () => {
    const model = new UmmToolsModel()
    const editor = new MetadataEditor(model)
    HTMLElement.prototype.scrollIntoView = jest.fn()

    const { container } = render(
      <MemoryRouter initialEntries={['/tool_drafts/2/edit/Tool_Information']}>
        <Routes>
          <Route path="/tool_drafts/:id/edit/:sectionName" element={<MetadataEditorForm editor={editor} />} />
        </Routes>
      </MemoryRouter>
    )
    await act(async () => null) // Popper update() - https://github.com/popperjs/react-popper/issues/350

    const clickTextField = screen.queryAllByTestId('error-list-item__type')

    await act(async () => {
      fireEvent.click(clickTextField[0])
      userEvent.tab()
    })
    expect(container).toMatchSnapshot()
  })

  test('testing autofocus against array section', async () => {
    const model = new UmmToolsModel()
    model.fullData = {
      PotentialAction: {
        Target: {
          ResponseContentType: [
            'response content type'
          ],
          HttpMethod: [
            'GET'
          ],
          Type: 'EntryPoint',
          Description: 'target description',
          UrlTemplate: 'url template'
        },
        Type: 'SearchAction'
      }
    }
    const editor = new MetadataEditor(model)
    editor.setFocusField('PotentialAction_Target_HttpMethod')
    HTMLElement.prototype.scrollIntoView = jest.fn()
    const { container } = render(
      <MemoryRouter initialEntries={['/tool_drafts/2/edit/Potential_Action']}>
        <Routes>
          <Route path="/tool_drafts/:id/edit/:sectionName" element={<MetadataEditorForm editor={editor} />} />
        </Routes>
      </MemoryRouter>
    )
    await waitFor(async () => {
      expect(HTMLElement.prototype.scrollIntoView).toBeCalled()
    })
    expect(container).toMatchSnapshot()
  })
})
