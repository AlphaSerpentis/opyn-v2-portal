import React, { useState, useEffect, useContext, useMemo, useCallback } from 'react'
import { Header, DataView, DropDown, useToast, Tag, Help, Button } from '@aragon/ui'
import BigNumber from 'bignumber.js'
import Status from '../../components/DataViewStatusEmpty'
import LabelText from '../../components/LabelText'
import CustomIdentityBadge from '../../components/CustomIdentityBadge'
import { walletContext } from '../../contexts/wallet'
import { useAsyncMemo } from '../../hooks/useAsyncMemo'
import { expiryToDate, toTokenAmount } from '../../utils/math'
import { getOracleAssetsAndPricers, getOTokens } from '../../utils/graph'
import SectionTitle from '../../components/SectionHeader'

import { SubgraphPriceEntry } from '../../types'
import { CTokenPricer, USDCPricer } from '../../utils/contracts/pricers'
import { pricerMap, PricerTypes } from './config'
import { ZERO_ADDR } from '../../constants/addresses'

export default function Oracle() {

  const { networkId, user, web3 } = useContext(walletContext)
  const toast = useToast()
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [selectedAssetIndex, setSelectedAssetIndex] = useState(-1)
  const [assetHistory, setAssetHistory] = useState<SubgraphPriceEntry[]>([])
  const [isReadyToSetPrice, setIsReadyToSetPrice] = useState(true)

  const [expiryIdxToSubmit, setExpiryIdxToSubmit] = useState(-1)

  const allOracleAssets = useAsyncMemo(async () => {
    const assets = await getOracleAssetsAndPricers(networkId, toast)
    setIsLoadingHistory(false)
    if(assets && assets.length > 0) setSelectedAssetIndex(0)
    return assets === null ? [] : assets
  }, [], [])

  const allOTokens = useAsyncMemo(async () => {
    const oTokens = await getOTokens(networkId, toast)
    return oTokens === null ? [] : oTokens
  }, [], [])

  const unsetExpiries = useMemo(() => {
    const alreadySet = assetHistory.map(entry => Number(entry.expiry))
    const unique = new Set(allOTokens
      .map(o => Number(o.expiryTimestamp))
      .filter(expiry => expiry < Date.now() / 1000)
      .filter(expiry => !alreadySet.includes(expiry)))
    return Array.from(unique)
    
  }, [assetHistory, allOTokens])

  const haveValidSelection = useMemo(()=>allOracleAssets.length > 0 && selectedAssetIndex !== -1, 
  [allOracleAssets, selectedAssetIndex]) 

  // check is ready to set price
  useEffect(() => {
    if(!haveValidSelection) return
    // if no expiry selected, return 
    if (expiryIdxToSubmit === -1) return

    // if it's USDC or cUSDC pricer, return true
    const selectedAsset = allOracleAssets[selectedAssetIndex].asset
    if (pricerMap[selectedAsset.symbol] === PricerTypes.CTokenPricer || pricerMap[selectedAsset.symbol] === PricerTypes.USDCPricer) {
      setIsReadyToSetPrice(true)
      return
    }

    // if it's chainlink pricer, search for the the valid roundId.

  }, [allOracleAssets, selectedAssetIndex, haveValidSelection, expiryIdxToSubmit])

  
  // update ths history array
  useEffect(() => {
    if (!haveValidSelection) return
    setAssetHistory(allOracleAssets[selectedAssetIndex].prices)
  },
  [selectedAssetIndex, allOracleAssets, haveValidSelection]
  )

  const setPrice = useCallback(
    () => {
      const selectedAsset = allOracleAssets[selectedAssetIndex].asset
      const pricer = allOracleAssets[selectedAssetIndex].pricer.id
      if(web3 === null) {
        toast('Please connect wallet first')
        return
      }
      if (pricerMap[selectedAsset.symbol] === PricerTypes.CTokenPricer) {
        const contract = new CTokenPricer(web3, pricer , networkId, user)
        contract.setPrice(unsetExpiries[expiryIdxToSubmit].toString())
      } else if (pricerMap[selectedAsset.symbol] === PricerTypes.USDCPricer) {
        const contract = new USDCPricer(web3, pricer, networkId, user)
        contract.setPrice(unsetExpiries[expiryIdxToSubmit].toString())
      } 
    },
    [allOracleAssets, selectedAssetIndex, expiryIdxToSubmit, networkId, user, web3, unsetExpiries, toast],
  )

  return (
    <>
      <Header primary="Oracle" />
      In Opyn v2, we need on-chain prices for underlying, strike and collateral assets to settle oTokens.
      <SectionTitle title="Choose an Asset" />
      <DropDown
        items={allOracleAssets ? allOracleAssets.map(p => p.asset.symbol) : []}
        selected={selectedAssetIndex}
        onChange={setSelectedAssetIndex}
      />
      <br/><br/>
      <SectionTitle title="Asset Detail" />
      <div style={{ display: 'flex', alignItems: 'center', paddingBottom: '3%' }}>
        <div style={{ width: '30%' }}>
          <LabelText label='Pricer' />
          <CustomIdentityBadge 
            label={haveValidSelection ? pricerMap[allOracleAssets[selectedAssetIndex].asset.symbol] : 'Unkown'}  
            entity={haveValidSelection ? allOracleAssets[selectedAssetIndex].pricer.id : ZERO_ADDR}
          />
        </div>

        <div style={{ width: '30%' }}>
        <div style={{display:'flex'}}>
          <LabelText label='Locking Period' /> 
          <Help hint={"What is locking period"} > 
            Period of time after expiry that price submission will not be accepted.
          </Help>
        </div>
          <div style={{paddingTop: '3%'}}>
          { haveValidSelection ? Number(allOracleAssets[selectedAssetIndex].pricer.lockingPeriod) / 60 : 0 } Minutes
          </div>
        </div>

        <div style={{ width: '30%' }}>
          <div style={{display:'flex'}}> <LabelText label='Dispute Period' /> <Help hint={"What is dispute period"} > 
            Period of time after price submission that the price can be overrided by the disputer.
          </Help> </div>
          <div style={{paddingTop: '3%'}}>
          { haveValidSelection ? Number(allOracleAssets[selectedAssetIndex].pricer.disputePeriod) / 60 : 0 } Minutes
          </div>
        </div>
      </div>
      
      <SectionTitle title="Submit Price" />

      <div style={{ display: 'flex', alignItems: 'center', paddingBottom: '3%' }}>
        <div style={{ width: '30%' }}>
          <DropDown 
            placeholder={'Choose Expiry'}
            items={unsetExpiries ? unsetExpiries.map(expiry => expiryToDate(expiry)) : []}
            selected={expiryIdxToSubmit}
            onChange={setExpiryIdxToSubmit}
          />
        </div>

        <div style={{ width: '30%' }}>
          <LabelText label=' ' /> 
          <Button 
            disabled={!isReadyToSetPrice || !haveValidSelection || expiryIdxToSubmit === -1}
            label={'Set Price'}
            onClick={setPrice}
          />
        </div>

      
      </div>

      <br></br>
      <SectionTitle title="Price Submissions" />
      <DataView
        status={isLoadingHistory ? 'loading' : 'default'}
        fields={['Expiry', 'Price', 'Submitted Timestamp', 'Submitted By']}
        statusEmpty={<Status label={"No submissions"} />}
        entries={assetHistory.sort((a,b) => Number(a.expiry) > Number(b.expiry) ? -1 : 1)}
        renderEntry={({expiry, reportedTimestamp, price, isDisputed}: SubgraphPriceEntry) => {
          const tag = isDisputed ? <Tag mode="new"> Disputer </Tag> : <Tag> Pricer </Tag>
          return [
            expiryToDate(expiry),
            `${toTokenAmount(new BigNumber(price), 8).toString()} USD`,
            reportedTimestamp,
            tag
            ]
        }}
      />
    </>
  )
}