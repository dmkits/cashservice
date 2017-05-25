
insert into z_LogCashReg (CRID,DocTime,CashRegAction,Status, Msg,Notes)
    values(@CRID , GETDATE(),0, 0, @Msg,null )