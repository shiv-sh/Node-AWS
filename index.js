const AWS = require('aws-sdk');
AWS.config.update({
    region:'us-east-1'
});
const dynamodb = new AWS.DynamoDB.DocumentClient();
const dynamoTableName = 'product-inventory';
const healthPath = '/health';
const productPath = '/product';
const productsPath = '/products';

exports.handler = async function(event) {
    console.log('Request event:',event);
    let response;
    switch(true) {
        case event.httpMethod === 'GET' && event.path === healthPath:
            response = buildResponse(200);
            break;
        case event.httpMethod === 'GET' && event.path === productPath:
            response = await getProduct(event.queryStringParameters.productId);
            break;
        case event.httpMethod === 'GET' && event.path === productsPath:
            response = await getProducts();
            break;
        case event.httpMethod === 'POST' && event.path === productPath:
            response = await saveProduct(JSON.parse(event.body));
            break;
        case event.httpMethod === 'PATCH' && event.path === productPath:
            const requestBody = JSON.parse(event.body)
            response = await modifyProduct(requestBody.productId,requestBody.updateKey, requestBody.updateValue);
            break;
        case event.httpMethod === 'DELETE' && event.path === productPath:
            response = await deleteProduct(JSON.parse(event.body).productId);
            break;
        default:
            response = buildResponse(404, '404 Not Found');     
    }
    return response;
}

async function getProduct(productId) {
    const params = {
        TableName: dynamoTableName,
        Key: {
            'productId':productId
        }
    }
    return await dynamodb.get(params).promise().then((response) => {
        return buildResponse(200, response.Item)
    }, (error)=>{
        console.error(`Error while finding the product ${productId} -> ${error}`)
    })
}

async function getProducts() {
    const params = {
        TableName: dynamoTableName
    }
    const allProducts = await scanDynamoRecords(params, []);
    const body = {
        products: allProducts
    }
    return buildResponse(200,body)
}

/* scanDynamoRecords is a recursive function, because there is a limit on 
how many records you can retrieve at one time
*/
async function scanDynamoRecords(scanParams, itemArray) {
    try {
        const dynamoData = await dynamodb.scan(scanParams).promise();
        itemArray = itemArray.concat(dynamoData.Items);
        if(dynamoData.LastEvaluatedKey) {
            return await scanDynamoRecords(scanParams,itemArray);
        }
        return itemArray;
    } catch(error) {
        console.log(`Error reading data -> ${error}`)
    }
}

async function saveProduct(requestBody) {
    const params = {
        TableName: dynamoTableName,
        Item: requestBody
    }
    return await dynamodb.put(params).promise().then(()=>{
        const body = {
            Operations: 'SAVE',
            message: 'SUCCESS',
            Item: requestBody
        }
        return buildResponse(200,body)
    }, (error)=>{
        console.error(`Error while saving -> ${error}`);
    })
}

async function modifyProduct(productId, updateKey, updateValue) {
    const params = {
        TableName: dynamoTableName,
        Key: {
            'productId':productId
        },
        UpdateExpression: `set ${updateKey} = :value`,
        ExpressionAttributeValues: {
            ':value': updateValue
        },
        returnValues: 'UPDATE_NEW'
    }
    return await dynamodb.update(params).promise().then((response) => {
        const body = {
            Operation: 'UPDATE',
            Message: 'SUCCESS',
            Item: response
        }
        return buildResponse(200,body);
    }, (error) => {
        console.error('Do your custom error handling here',error)
    })
}

async function deleteProduct(productId) {
    const params = {
        TableName:dynamoTableName,
        Key: {
            'productId': productId
        },
        ReturnValues: 'ALL_OLD'
    }
    return await dynamodb.delete(params).promise().then((response)=>{
        const body = {
            Operation:'DELETE',
            Message:'SUCCESS',
            Item:response
        }
        return buildResponse(200,body);
    }, (error)=>{
        console.error('Error in delete',error)
    })
}

function buildResponse(statusCode, body) {
    return {
        statusCode: statusCode,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    }
}