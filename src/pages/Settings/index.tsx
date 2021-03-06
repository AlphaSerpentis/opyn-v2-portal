import React from 'react'
import { Header } from '@aragon/ui'

import ThemeSwitch from './Theme'
import ApproveSwitch from './Approval'
import ClearCache from './ClearCache'
import Network from './Network'
import Refresh from './Refresh'

function Settings({ setTheme }: { setTheme: any }) {
  return (
    <>
      <Header primary="Settings" />
      <ThemeSwitch setTheme={setTheme} />
      <br />
      <ApproveSwitch />
      <br />
      <ClearCache />
      <br />
      <br />
      <Network />
      <br />
      <Refresh />
    </>
  )
}

export default Settings
